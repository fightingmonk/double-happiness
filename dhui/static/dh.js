
/****
 * Argument types
 ****/
var kArgTypeWord = 'word';
var kArgTypePassword = 'password';
var kArgTypeText = 'text';
var kArgTypeUrl = 'url';
var kArgTypeEmail = 'email';
var kArgTypeFriend = 'friend';
var kArgTypeMessageId = 'message';

var kArgRequired = 'required';
var kArgOptional = 'optional';


var term = null;
var photo_uploader;

function initialize() {
	if ((!term) || (term.closed)) {
		term = new Terminal(
			{
				x: 220,
				y: 70,
				termDiv: 'termDiv',
				bgColor: '#232e45',
				greeting: "connecting...",
				handler: termHandler,
				initHandler: termDidInit,
				exitHandler: termExitHandler,
				crsrBlinkMode: true,
				closeOnESC: false
			}
		);
		term.open();

	}

    photo_uploader = new qq.FileUploader({
			element: document.getElementById('file-uploader'),
			action: '/api/photo/',
			params: {},
			debug: false,
			allowedExtensions: ['jpg', 'jpeg', 'png', 'gif',],
			onComplete: function(id, fileName, responseJSON){ photoDone(responseJSON); },
			onCancel: function(id, fileName){ photoCancel(); },
			showMessage: function(msg) { photoMessage(msg); }
		});


}

function updateBackground(data) {
		if (data) {
				var landscape = (document.getElementById)?
					document.getElementById('landscape') : document.all.landscape;
				if (landscape) {
					var content = data.join('<br>');
					landscape.innerHTML = content;
				}
		}
}





/*****************
 * API Interfaces
 *****************/

function getPing() {
		term.send({url: '/api/ping/',
				   method: 'get',
				   callback: onPingResponse
				});
}

function onPingResponse() {
    if (this.socket.status == "200") {
	    // status 200 OK
	    var res = JSON.parse(this.socket.responseText);
		if (res.alerts && res.alerts.length) {
				// show whatever alerts were sent down...
		}
	}
	setTimeout(getPing, 10000);
}


function getIssue() {
		var landscape = (document.getElementById)?
			document.getElementById('landscape') : document.all.landscape;
		var pw = 80, ph = 24;
		if (landscape) {
			pw = parseInt(parseFloat(landscape.offsetWidth) / 7.26);
			ph = parseInt(parseFloat(landscape.offsetHeight) / 12.0);
		}
		term.lock = true;
		term.send({url: '/api/issue/?pw=' + pw + '&ph=' + ph,
				   method: 'get',
				   callback: onIssueResponse
				});
}
function onIssueResponse() {
	if (this.socket.status == "200") {
	   // status 200 OK
	   var res = JSON.parse(this.socket.responseText);
		if (res.email) {
				// user is already logged in...
				this.env.user = res.email;
				this.env.login_name = null;
		}
	   if (res.issue) {
				this.write("\n"+res.issue.join('\n'));
	   }

	   if (res.background) {
				updateBackground(res.background);
	   }

		if (processHash())
				return;

		if (this.env.user) {
				// we're already logged in...
				getMotd();
				return;
		}
		else {
				this.write("\n  (Don't have an account? Enter your email and desired password to register)\n\n");
		}
	}
	else if (this.socket.errno) {
	   // connection failed
	   this.write("Connection error: " + this.socket.errstring);
	}
	else {
	   // connection succeeded, but server returned other status than 2xx
	   this.write("System error: " +
				  this.socket.status + " " + this.socket.statusText);
	   this.write(this.socket.responseText, true);
	}

	showPrompt();
}

function getMotd() {
		var landscape = (document.getElementById)?
			document.getElementById('landscape') : document.all.landscape;
		var pw = 80, ph = 24;
		if (landscape) {
			pw = parseInt(parseFloat(landscape.offsetWidth) / 7.26);
			ph = parseInt(parseFloat(landscape.offsetHeight) / 12.0);
		}
		term.lock = true;
		term.send({url: '/api/motd/?pw=' + pw + '&ph=' + ph,
				   method: 'get',
				   callback: onMotdResponse
				});
}
function onMotdResponse() {
	if (this.socket.status == "200") {
	   // status 200 OK
	   var res = JSON.parse(this.socket.responseText);
	   if (res.status == '401') {
				getLogout();
				return;
	   }
	   if (res.motd) {
		motd = res.motd;
		this.write("\n"+motd.join('\n'));
	   }

	   if (res.background) {
				updateBackground(res.background);
	   }

	   if (res.pending_friends) {
	     var msg = "You have pending friend requests from:\n";
	     for (var i=0; i<res.pending_friends.length; i++) {
	     	msg += "    " + res.pending_friends[i] + "\n";
	     }
	     msg += "Accept them with the `welcome` command...\n";
	   	this.write(msg);
	   }
	   else {
		   // TODO pick a random hint to show
		   this.write("Hint: use `befriend` to invite people you know and love");
		}
	}
	else if (this.socket.errno) {
	   // connection failed
	   this.write("Connection error: " + this.socket.errstring);
	}
	else {
	   // connection succeeded, but server returned other status than 2xx
	   this.write("System error: " +
				  this.socket.status + " " + this.socket.statusText);
	   this.write(this.socket.responseText, true);
	}

    showPrompt();
}

function getLogin(email, password) {
		term.lock = true;
		term.send({url: '/api/login/',
				   method: 'post',
				   data: { 'email': email, 'password': password,
						   'csrfmiddlewaretoken': getCookie('csrftoken') },
				   callback: onLoginResponse
				});
}

function onLoginResponse() {
	if (this.socket.status == "200") {
	   // status 200 OK
	   var res = JSON.parse(this.socket.responseText);
	   if (res.status == '200') {
				this.env.user = res.email;
				this.env.login_name = null;
				getMotd();
				return;
	   }
	   else if (res.status == '201') {
				this.env.user = null;
				this.env.login_name = null;
				this.write("Welcome home.\n"+
						   "Please check your email for instructions on activating your account.\n");
				showPrompt();
				return;
	   }
	   else if (res.status == '202') {
				this.env.user = null;
				this.env.login_name = null;
				this.write("You're new here.\n");
				this.env.expect_prompt = "Would you like to create an account? (y/n)";
				this.env.expect = [['y', function(){ getRegister(res.email, res.password); }],
								   ['n', clearExpect]];
				showPrompt();

				return;
	   }
	   else {
		    this.write(res.message+"\n");
		    getIssue();
		    return;
	   }
	}
	else if (this.socket.errno) {
	   // connection failed
	   this.write("Connection error: " + this.socket.errstring);
	}
	else {
	   // connection succeeded, but server returned other status than 2xx
	   this.write("System error: " +
				  this.socket.status + " " + this.socket.statusText);
	   this.write(this.socket.responseText, true);
	}

    this.env.user = null;
    this.env.login_name = null;

	showPrompt();

}

function getRegister(email, password) {
		term.lock = true;
		term.send({url: '/api/register/',
				   method: 'post',
				   data: { 'email': email, 'password': password,
						   'csrfmiddlewaretoken': getCookie('csrftoken') },
				   callback: onLoginResponse
				});
}

function getVerify(token, password) {
		// password is actually a RegExp match object... group[1] is the captured password
		term.lock = true;
		clearExpect();
		term.send({url: '/api/verify/',
				   method: 'post',
				   data: { 'token': token,
						   'password': password[1],
						   'csrfmiddlewaretoken': getCookie('csrftoken') },
				   callback: onVerifyResponse
				});
}
function onVerifyResponse() {
	if (this.socket.status == "200") {
	   // status 200 OK
	   var res = JSON.parse(this.socket.responseText);
	   if (res.status == '200') {
				this.env.user = res.email;
				this.env.login_name = null;
				getMotd();
				return;
	   }
	   else {
		    this.write(res.message+"\n");
			showPrompt();
			return;
	   }
	}
	else if (this.socket.errno) {
	   // connection failed
	   this.write("Connection error: " + this.socket.errstring);
	}
	else {
	   // connection succeeded, but server returned other status than 2xx
	   this.write("System error: " +
				  this.socket.status + " " + this.socket.statusText);
	   this.write(this.socket.responseText, true);
	}

	getIssue();

}

function getLogout() {
		term.clear();
		term.lock = true;
		term.send({url: '/api/logout/',
				   method: 'post',
				   data: { 'csrfmiddlewaretoken': getCookie('csrftoken') },
				   callback: onLogoutResponse
				});
}

function quietLogout() {
		term.send({url: '/api/logout/',
		   method: 'post',
		   data: { 'csrfmiddlewaretoken': getCookie('csrftoken') },
		   callback: function() {}
		});

}
function onLogoutResponse() {
	if (this.socket.status == "200") {
	    // status 200 OK
	    var res = JSON.parse(this.socket.responseText);
		this.env.user = null;
		this.env.login_name = null;
		getIssue();
		return;
	}
	else if (this.socket.errno) {
	   // connection failed
	   this.write("Connection error: " + this.socket.errstring);
	}
	else {
	   // connection succeeded, but server returned other status than 2xx
	   this.write("System error: " +
				  this.socket.status + " " + this.socket.statusText);
	   this.write(this.socket.responseText, true);
	}

}

function updatePassword(argv) {
		if (argv.length != 3) {
				showHelp(['help', 'passwd']);
				return;
		}

		term.lock = true;
		term.send({url: '/api/passwd/',
				   method: 'post',
   				   data: { 'csrfmiddlewaretoken': getCookie('csrftoken'),
						   'current_password': argv[1],
						   'replacement_password': argv[2]},
				   callback: genericResponse
				});
}

function updateName(argv) {
		if (argv.length < 2) {
				showHelp(['help', 'chfn']);
				return;
		}
		argv.shift();
		var fn = argv.shift();
		var ln = argv.join(" ");

		term.lock = true;
		term.send({url: '/api/chfn/',
				   method: 'post',
   				   data: { 'csrfmiddlewaretoken': getCookie('csrftoken'),
						   'first_name': fn,
						   'last_name': ln},
				   callback: genericResponse
				});
}


function getWhoami() {
		term.lock = true;
		term.send({url: '/api/whoami/',
				   method: 'post',
   				   data: { 'csrfmiddlewaretoken': getCookie('csrftoken') },
				   callback: onWhoamiResponse
				});
}
function onWhoamiResponse() {
	if (this.socket.status == "200") {
	   // status 200 OK
	   var res = JSON.parse(this.socket.responseText);
	   if (res.status == '401') {
				getLogout();
				return;
	   }
	   else if (res.status == '403') {
		this.write("access denied\n");
	   }
	   else if (res.status == '501') {
		this.write("feature not available\n");
	   }
	   else if (res.status != '200') {
		this.write("happy error "+res.status+"\n");
	   }
	   else {
		this.write(res.response + "\n");

		if (res.response.substring(0, 1) == '<') {
				this.write("Hint: use `chfn` to set your name");
		}
	   }
	}
	else if (this.socket.errno) {
	   // connection failed
	   this.write("Connection error: " + this.socket.errstring);
	}
	else {
	   // connection succeeded, but server returned other status than 2xx
	   this.write("System error: " +
				  this.socket.status + " " + this.socket.statusText);
	   this.write(this.socket.responseText, true);
	}

    showPrompt();
}

function getBefriend(argv) {
		if (argv.length != 2) {
				showHelp(["help", "befriend"]);
		}
		else {
				term.lock = true;
				term.send({url: '/api/befriend/',
						   method: 'post',
						   data: { 'csrfmiddlewaretoken': getCookie('csrftoken'),
								   'email': argv[1]},
						   callback: genericResponse
						});
		}
}

function getWelcome(argv) {
		if (argv.length != 2) {
				showHelp(["help", "welcome"]);
		}
		else {
				term.lock = true;
				term.send({url: '/api/welcome/',
						   method: 'post',
						   data: { 'csrfmiddlewaretoken': getCookie('csrftoken'),
								   'email': argv[1]},
						   callback: genericResponse
						});
		}
}



function updateStatus(argv) {
		if (argv.length < 2) {
				showHelp(["help", "status"]);
		}
		else {
				argv.shift();
				term.lock = true;
				term.send({url: '/api/status/',
						   method: 'post',
						   data: { 'csrfmiddlewaretoken': getCookie('csrftoken'),
								   'status': argv.join(' ') },
						   callback: genericResponse
						});
		}
}

function getLast(argv) {
		term.lock = true;
		data = { 'csrfmiddlewaretoken': getCookie('csrftoken') };
		if (argv.length == 2) {
				data['email'] = argv[1];
		}

		term.send({url: '/api/last/',
				method: 'post',
				data: data,
				callback: onLastResponse
				});

}

function formatStatus(data, show_whom) {
		var out = "";
		if (data.status.type == 'status') {
				if (show_whom) {
						out += pad(formatDate(data.date), 15) + "   " + data.friend;
						out += "\n    " + data.status.status;
				}
				else {
						out += pad(formatDate(data.date), 15) + "    " + data.status.status;
				}
		}
		else if (data.status.type == 'photo') {
				if (show_whom) {
						out += pad(formatDate(data.date), 15) + "   " + data.friend + " shared a photo\n";
				}
				else {
						out += pad(formatDate(data.date), 15) + "    shared a photo\n";
				}

				if (data.status.title.length) {
						out += "    " + data.status.title + "\n";
				}
				out += data.status.image.join("\n");
		}

		return out;
}

function onLastResponse() {
	if (this.socket.status == "200") {
	   // status 200 OK
	   var res = JSON.parse(this.socket.responseText);
	   if (res.status == '200') {
		if (res.statuses) {
				var status_text = "";
				if (res.whom) {
						status_text = ""+res.whom+"\n";
						for (var i=0; i<res.statuses.length; i++) {
								status_text += formatStatus(res.statuses[i], false) + "\n";
						}
						this.write(status_text, true);
				}
				else {
						for (var i=0; i<res.statuses.length; i++) {
								status_text += formatStatus(res.statuses[i], true) + "\n";
						}
				}
				this.write(status_text, true);
				return;
		}
		else {
				this.write("Nothing new");
		}
	   }
	   else {
		if (res.message) {
				this.write("ERROR "+res.message+"\n");
		}
		else {
				this.write("ERROR");
		}
	   }

	   if (res.background) {
				updateBackground(res.background);
	   }
	}
	else if (this.socket.errno) {
	   // connection failed
	   this.write("Connection error: " + this.socket.errstring);
	}
	else {
	   // connection succeeded, but server returned other status than 2xx
	   this.write("System error: " +
				  this.socket.status + " " + this.socket.statusText);
	   this.write(this.socket.responseText, true);
	}

    showPrompt();
}


function getW(argv) {
		term.lock = true;
		data = { 'csrfmiddlewaretoken': getCookie('csrftoken') };

		term.send({url: '/api/w/',
				method: 'post',
				data: data,
				callback: onWResponse
				});

}

function onWResponse() {
	if (this.socket.status == "200") {
	   // status 200 OK
	   var res = JSON.parse(this.socket.responseText);
	   if (res.status == '200') {
		if (res.people) {
				var info = pad("Last Login", 15)+"   Name\n";
				for (var i=0; i<res.people.length; i++) {
						var p = res.people[i];
						info += pad(formatDate(p.last_login), 15)+"   "+p.name+"\n";
				}
				this.write(info, true);
				return;
		}
		else {
				this.write("No one is online (not even you!)");
		}
	   }
	   else {
		if (res.message) {
				this.write("ERROR "+res.message+"\n");
		}
		else {
				this.write("ERROR");
		}
	   }
	}
	else if (this.socket.errno) {
	   // connection failed
	   this.write("Connection error: " + this.socket.errstring);
	}
	else {
	   // connection succeeded, but server returned other status than 2xx
	   this.write("System error: " +
				  this.socket.status + " " + this.socket.statusText);
	   this.write(this.socket.responseText, true);
	}

    showPrompt();
}

function getPoke(argv) {
		if (argv.length != 2) {
				showHelp(["help", "poke"]);
		}
		else {
				term.lock = true;
				term.send({url: '/api/poke/',
						   method: 'post',
						   data: { 'csrfmiddlewaretoken': getCookie('csrftoken'),
								   'email': argv[1]},
						   callback: genericResponse
						});
		}
}

function getFinger(argv) {
		if (argv.length != 2) {
				showHelp(["help", "finger"]);
		}
		else {
				term.lock = true;
				term.send({url: '/api/finger/',
						   method: 'post',
						   data: { 'csrfmiddlewaretoken': getCookie('csrftoken'),
								   'email': argv[1]},
						   callback: onFingerResponse
						});
		}
}
function onFingerResponse() {
	if (this.socket.status == "200") {
	   // status 200 OK
	   var res = JSON.parse(this.socket.responseText);
	   if (res.status == '200' && res.whom) {
				var message = [res.whom,
							    ((res.online) ? "ONLINE " : "OFFLINE") +
							   "  Last login "+pad(formatDate(res.last_login), 15) +
							   "  Joined "+pad(formatDate(res.joined), 15) ];

				if (res.last_status) {
						// TODO refactor to use pagination and treat statuses as an array of hashes with type, status, title, image, etc in them
						message.push("  ["+formatDate(res.last_status_at)+"] "+res.last_status);
				}
				this.write(message.join("\n"));
	   }
	   else {
		if (res.message) {
				this.write("ERROR "+res.message+"\n");
		}
		else {
				this.write("ERROR");
		}
	   }
	}
	else if (this.socket.errno) {
	   // connection failed
	   this.write("Connection error: " + this.socket.errstring);
	}
	else {
	   // connection succeeded, but server returned other status than 2xx
	   this.write("System error: " +
				  this.socket.status + " " + this.socket.statusText);
	   this.write(this.socket.responseText, true);
	}

    showPrompt();
}


function showPhoto(argv) {
	var title = "";
	if (argv.length > 1) {
		argv.shift();
		title = argv.join(" ");
	}

    photo_uploader.setParams({ title: title });

    var form = document.getElementById('photo-form');
	var f = form[0];
	f.click();

}

function hidePhoto() {
	var popup = document.getElementById('photobox');
	popup.style.display = 'none';
	popup.style.visibility = 'hidden';

	TermGlobals.keylock = false;
	term.lock = false;
}

function photoMessage(msg) {
    hidePhoto();
    term.write(msg + "\n");
	showPrompt();
}
function photoDone(result) {
    hidePhoto();

		if (result.photo) {
				term.clear();
				term.write("OK photo posted\n\n" + result.photo.join('\n'), true);
		}
		else {
				if (result.error) {
						term.write("ERROR "+result.error+"\n");
				}
				else {
						term.write("ERROR something went awry\n");
				}
			showPrompt();

		}
}

function photoCancel() {
	hidePhoto();
	showPrompt();
}


function genericResponse() {
	if (this.socket.status == "200") {
	   // status 200 OK
	   var res = JSON.parse(this.socket.responseText);
	   if (res.status == '200' || res.status == '201') {
		if (res.message) {
				this.write("OK "+res.message+"\n");
		}
		else {
				this.write("OK");
		}
	   }
	   else {
		if (res.message) {
				this.write("ERROR "+res.message+"\n");
		}
		else {
				this.write("ERROR");
		}
	   }

	   if (res.background) {
				updateBackground(res.background);
	   }
	}
	else if (this.socket.errno) {
	   // connection failed
	   this.write("Connection error: " + this.socket.errstring);
	}
	else {
	   // connection succeeded, but server returned other status than 2xx
	   this.write("System error: " +
				  this.socket.status + " " + this.socket.statusText);
	   this.write(this.socket.responseText, true);
	}

    showPrompt();
}


function showHelp(argv) {
		var output = "";
		if (argv.length > 1) {
				var found = false;
				for (var i=0; i<commands.length; i++) {
						if (argv[1] == commands[i][0]) {
								output += "\n"+commands[i][0];
								var args = commands[i][2];
								if (args.length) {
										for (var j=0; j<args.length; j++) {
												if (args[j][3] == kArgRequired)
														output += " ["+args[j][1]+"]";
												else if (args[j][3] == kArgOptional)
														output += " <"+args[j][1]+">";
												else
														output += " "+args[j][1];
										}
								}
								output += "\n  synopsis...";

								found = true;
						}
				}
				if (! found) {
						output += "\nThere's no help for "+argv[1];
				}
				term.write(output);
				showPrompt();
		}
		else {
				output += "\nAvailable commands\n";
				for (var i=0; i<commands.length; i++) {
						output += "    " + pad(commands[i][0], 12);
						var args = commands[i][2];
						if (args.length) {
								for (var j=0; j<args.length; j++) {
										if (args[j][3] == kArgRequired)
												output += " ["+args[j][1]+"]";
										else if (args[j][3] == kArgOptional)
												output += " <"+args[j][1]+">";
										else
												output += " "+args[j][1];
								}
						}
						output += "\n";
				}
				term.clear();
				term.write(output, true);
		}
}
function notImplemented(argv) {
		term.write("Sorry, "+argv[0]+" ain't quite there yet.");
		showPrompt();
}

/****
 * Available commands, with their arguments
 ****/
var commands = [
    ['help', showHelp, []],
	['?', showHelp, []],
	['logout', getLogout, []],
	['motd', getMotd, []],
	['passwd',
	 updatePassword,
	 [[kArgTypePassword, 'current_password', 'Current Password?', kArgRequired],
	  [kArgTypePassword, 'replacement_password', 'Replacement Password?', kArgRequired]]],
	['chfn',
	 updateName,
	 [[kArgTypeWord, 'first_name', 'First Name?', kArgRequired],
      [kArgTypeWord, 'last_name', 'Last Name?', kArgOptional]]],

	['befriend',
	 getBefriend,
	 [[kArgTypeEmail, 'email', 'Email Address?', kArgRequired]]],
	['welcome',
	 getWelcome,
	 [[kArgTypeEmail, 'email', 'Welcome whom?', kArgRequired]]],
	['shun',
	 notImplemented,
	 [[kArgTypeFriend, 'friend', 'Shun whom?', kArgRequired]]],

	['status',
	 updateStatus,
	 [[kArgTypeText, 'status', 'Status?', kArgRequired]]],
	['photo',
	 showPhoto,
	 [[kArgTypeText, 'title', 'Title?', kArgOptional]]],
	['poke',
	 getPoke,
	 [[kArgTypeFriend, 'friend', 'Shun whom?', kArgRequired]]],
	['message',
	 notImplemented,
	 [[kArgTypeFriend, 'friend', 'To whom?', kArgRequired],
      [kArgTypeText, 'message', 'Message?', kArgRequired]]],
	['link',
	 notImplemented,
	 []],
	['inbox',
	 notImplemented,
	 []],
	['read',
	 notImplemented,
	 []],
	['delete',
	 notImplemented,
	 []],

	['w',
	 getW,
	 []],
	['finger',
	 getFinger,
	 [[kArgTypeFriend, 'friend', 'Finger whom?', kArgRequired]]],
	['whoami',
	 getWhoami, []],
	['last',
	 getLast,
	 [[kArgTypeFriend, 'friend', 'Anyone in particular?', kArgOptional]]],

];

function processHash() {
		var hash = document.location.hash;
		if (hash) {
				var args = hash.substring(1).split('=', 2);
				if (args[0] == 'register' && args.length == 2 && args[1].length > 10) {
						quietLogout();
						term.write("\nHello.\n\n");
						term.env.expect_prompt = "Please enter your password to activate your account:";
						term.env.expect = [[new RegExp(/^(.{4,64})$/), function(password){ getVerify(args[1], password); }],
										   ['', clearExpect]];
						showPrompt();
						return true;
				}
		}

		return false;
}

function clearExpect() {
		term.env.expect_prompt = null;
		term.env.expect = null;

		showPrompt();
}

/*****************
 * Terminal I/O Handlers
 *****************/

function termDidInit() {

		term.env.user = null;
		term.env.login_name = null;

		// fire up the keepalive engine
		getPing();

		getIssue();

}


function showPrompt() {
		if (term.env.expect_prompt && term.env.expect) {
			term.ps = term.env.expect_prompt;
		}
		else if (term.env.user) {
				// todo populate the prompt with other things we might need to know
				term.ps = term.env.user + ' >';
		}
		else {
				if (term.env.login_name) {
						term.ps = 'password: ';
				}
				else {
						term.ps = 'email: ';
				}
		}

		term.prompt();
}



function termExitHandler() {
	// reset the UI
	var mainPane = (document.getElementById)?
		document.getElementById('mainPane') : document.all.mainPane;
	if (mainPane) mainPane.className = 'lh15';
}
function pasteCommand(text) {
	// insert given text into the command line and execute
	var termRef = TermGlobals.activeTerm;
	if ((!termRef) || (termRef.closed)) {
		alert('Please open the terminal first.');
		return;
	}
	if ((TermGlobals.keylock) || (termRef.lock)) return;
	termRef.cursorOff();
	termRef._clearLine();
	for (var i=0; i<text.length; i++) {
		TermGlobals.keyHandler({which: text.charCodeAt(i), _remapped:true});
	}
	TermGlobals.keyHandler({which: termKey.CR, _remapped:true});
}

function termHandler() {
	this.newLine();

    if (this.env.expect) {
		var input = this.lineBuffer.toLowerCase();
		for (var i=0; i<this.env.expect.length; i++) {
				var want = this.env.expect[i][0];
				if (typeof(want) == 'string') {
						var l = want.length;
						if (l == 0) {
								if (input.length == 0) {
										this.env.expect[i][1](input);
										return;
								}
						}
						else if (input.substring(0, l) == want) {
								this.env.expect[i][1](input);
								return;
						}
				}
				else if (want.exec) {
						var m = input.match(want);
						if (m) {
								this.env.expect[i][1](m);
								return;
						}
				}
				else {
						alert(typeof(want));
				}
		}
		showPrompt();
		return;
	}
    if (! term.env.user) {
		this.lock = true;
		if (! term.env.login_name) {
				// set the input to be our login email address if it's valid...
				if (this.lineBuffer.length > 4) { // todo proper email regex
						term.env.login_name = this.lineBuffer;
				}
				else {
						this.write("Please enter your email address...");
				}
		}
		else {
				// it's the password
				var email = term.env.login_name;
				term.env.login_name = null;
				var password = this.lineBuffer;
				this.lineBuffer = '';
				if (email && password && password.length >= 4) {
						getLogin(email, password);
						return;
				}
		}

		showPrompt();
		return;
	}

	this.lineBuffer = this.lineBuffer.replace(/^\s+/, '');

	var argv = this.lineBuffer.split(/\s+/);
	var cmd = argv[0];
    var handled = false;
    for (var i=0; i<commands.length; i++) {
		if (cmd == commands[i][0]) {
				var cmd_args = commands[i][2];
				// TODO handle checking for and acquiring arguments

				commands[i][1](argv);
				return;
		}
	}
	if (! handled) {
			if (this.lineBuffer != '') {
				this.type(this.lineBuffer + ': Yo no soy');
				this.newLine();
			}
	}

	showPrompt();
}



function pad(str, len) {
		while (str.length < len)
				str += " ";
		return str;
}
function parseLeadingInt(str) {
	var i = 0;
	while (str.length > 0 && str.substr(0, 1) == '0') {
		str = str.substr(1);
	}
	if (str.length) {
		i = parseInt(str);
	}
	return i;
}

var date_regexp = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/;
function parseDate(str) {
		var dt;
		try {
			dt = new Date(str);
		}
		catch (e) {
			dt = null;
		}

		if (! dt || isNaN(dt)) {
			var m = str.match(date_regexp);
			if (m) {
				var dy = parseLeadingInt(m[1]);
				var dm = parseLeadingInt(m[2]);
				var dd = parseLeadingInt(m[3]);
				var dh = parseLeadingInt(m[4]);
				var dn = parseLeadingInt(m[5]);
				var ds = parseLeadingInt(m[6]);

			    dt = new Date(dy, dm, dd, dh, dn, ds, 0);
			}
		}

		return dt;
}

function formatDate(timestamp) {
		var d = parseDate(timestamp);
		if (! d || isNaN(d)) {
			return "";
		}
		var now = new Date();
		if (d.getFullYear() != now.getFullYear()) {
				return dateFormat(d, "mmm d yyyy, h:MM tt");
		}
		if (d.getFullYear() == now.getFullYear()
			&& d.getMonth() == now.getMonth()
			&& d.getDate() == now.getDate()) {
				return dateFormat(d, "h:MM tt");
		}

		var delta = now.getTime() - d.getTime();
		var week = 6 * 24 * 60 * 60 * 1000;
		if (delta > week) {
				return dateFormat(d, "mmm d, h:MM tt");
		}

		return dateFormat(d, "ddd, h:MM tt");
}

/*
function getCookie(name) {
        var cookieValue = null;
        if (document.cookie && document.cookie != '') {
            var cookies = document.cookie.split(';');
            for (var i = 0; i < cookies.length; i++) {
                var cookie = jQuery.trim(cookies[i]);
                // Does this cookie string begin with the name we want?
                if (cookie.substring(0, name.length + 1) == (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
*/
function getCookie(search_name) {
  // note: document.cookie only returns name=value, not the other components
  var tab_cookies = document.cookie.split( ';' );
  for ( i = 0; i < tab_cookies.length; i++ ) {
    // now we'll split apart each name=value pair
    var cookie_tmp = tab_cookies[i].split('=');
    // and trim left/right whitespace while we're at it
    var cookie_name = cookie_tmp[0].replace(/^\s+|\s+$/g, '');
    // if the extracted name matches passed search_name
    if (cookie_name==search_name) {
      // we need to handle case where cookie has no value but exists (no = sign, that is):
      if (cookie_tmp.length>1) {
        return unescape( cookie_tmp[1].replace(/^\s+|\s+$/g, '') );
      }
      // cookie is initialized but no value => result = null
      return null;
    }
  }
  return null;
}

/*
 * Date Format 1.2.3
 * (c) 2007-2009 Steven Levithan <stevenlevithan.com>
 * MIT license
 *
 * Includes enhancements by Scott Trenda <scott.trenda.net>
 * and Kris Kowal <cixar.com/~kris.kowal/>
 *
 * Accepts a date, a mask, or a date and a mask.
 * Returns a formatted version of the given date.
 * The date defaults to the current date/time.
 * The mask defaults to dateFormat.masks.default.
 */

var dateFormat = function () {
	var	token = /d{1,4}|m{1,4}|yy(?:yy)?|([HhMsTt])\1?|[LloSZ]|"[^"]*"|'[^']*'/g,
		timezone = /\b(?:[PMCEA][SDP]T|(?:Pacific|Mountain|Central|Eastern|Atlantic) (?:Standard|Daylight|Prevailing) Time|(?:GMT|UTC)(?:[-+]\d{4})?)\b/g,
		timezoneClip = /[^-+\dA-Z]/g,
		pad = function (val, len) {
			val = String(val);
			len = len || 2;
			while (val.length < len) val = "0" + val;
			return val;
		};

	// Regexes and supporting functions are cached through closure
	return function (date, mask, utc) {
		var dF = dateFormat;

		// You can't provide utc if you skip other args (use the "UTC:" mask prefix)
		if (arguments.length == 1 && Object.prototype.toString.call(date) == "[object String]" && !/\d/.test(date)) {
			mask = date;
			date = undefined;
		}

		// Passing date through Date applies Date.parse, if necessary
		date = date ? parseDate(date) : new Date;
		if (isNaN(date)) {
			throw SyntaxError("invalid date");
		}
		mask = String(dF.masks[mask] || mask || dF.masks["default"]);

		// Allow setting the utc argument via the mask
		if (mask.slice(0, 4) == "UTC:") {
			mask = mask.slice(4);
			utc = true;
		}

		var	_ = utc ? "getUTC" : "get",
			d = date[_ + "Date"](),
			D = date[_ + "Day"](),
			m = date[_ + "Month"](),
			y = date[_ + "FullYear"](),
			H = date[_ + "Hours"](),
			M = date[_ + "Minutes"](),
			s = date[_ + "Seconds"](),
			L = date[_ + "Milliseconds"](),
			o = utc ? 0 : date.getTimezoneOffset(),
			flags = {
				d:    d,
				dd:   pad(d),
				ddd:  dF.i18n.dayNames[D],
				dddd: dF.i18n.dayNames[D + 7],
				m:    m + 1,
				mm:   pad(m + 1),
				mmm:  dF.i18n.monthNames[m],
				mmmm: dF.i18n.monthNames[m + 12],
				yy:   String(y).slice(2),
				yyyy: y,
				h:    H % 12 || 12,
				hh:   pad(H % 12 || 12),
				H:    H,
				HH:   pad(H),
				M:    M,
				MM:   pad(M),
				s:    s,
				ss:   pad(s),
				l:    pad(L, 3),
				L:    pad(L > 99 ? Math.round(L / 10) : L),
				t:    H < 12 ? "a"  : "p",
				tt:   H < 12 ? "am" : "pm",
				T:    H < 12 ? "A"  : "P",
				TT:   H < 12 ? "AM" : "PM",
				Z:    utc ? "UTC" : (String(date).match(timezone) || [""]).pop().replace(timezoneClip, ""),
				o:    (o > 0 ? "-" : "+") + pad(Math.floor(Math.abs(o) / 60) * 100 + Math.abs(o) % 60, 4),
				S:    ["th", "st", "nd", "rd"][d % 10 > 3 ? 0 : (d % 100 - d % 10 != 10) * d % 10]
			};

		return mask.replace(token, function ($0) {
			return $0 in flags ? flags[$0] : $0.slice(1, $0.length - 1);
		});
	};
}();

// Some common format strings
dateFormat.masks = {
	"default":      "ddd mmm dd yyyy HH:MM:ss",
	shortDate:      "m/d/yy",
	mediumDate:     "mmm d, yyyy",
	longDate:       "mmmm d, yyyy",
	fullDate:       "dddd, mmmm d, yyyy",
	shortTime:      "h:MM TT",
	mediumTime:     "h:MM:ss TT",
	longTime:       "h:MM:ss TT Z",
	isoDate:        "yyyy-mm-dd",
	isoTime:        "HH:MM:ss",
	isoDateTime:    "yyyy-mm-dd'T'HH:MM:ss",
	isoUtcDateTime: "UTC:yyyy-mm-dd'T'HH:MM:ss'Z'"
};

// Internationalization strings
dateFormat.i18n = {
	dayNames: [
		"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat",
		"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
	],
	monthNames: [
		"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
		"January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"
	]
};

// For convenience...
Date.prototype.format = function (mask, utc) {
	return dateFormat(this, mask, utc);
};
