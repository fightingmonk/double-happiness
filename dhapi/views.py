# encoding: utf-8
import datetime

from django.http import HttpResponse
from django.contrib import auth
from django.contrib.auth.models import User, check_password
from django.core.mail import send_mail
from django.utils.translation import ugettext as _
from django.middleware.csrf import get_token
from django.views.decorators.csrf import csrf_exempt

from dhapi import utils
from dhapi import models

def ping(request):
    alerts = []
    if request.user.is_authenticated():
        models.Active.objects.flag_user(request.user)
        # todo fetch any alerts waiting for the user and populate


    return HttpResponse(utils.json_encode({'status': 200,
                                           'message': 'pong',
                                           'alerts': alerts,
                                          }))


def issue(request):
    if request.user.is_authenticated():
        # user is already logged in...
        return motd(request)

    msg = [
           u" ******************************************************************************",
           u" ****************************        福   福        ****************************",
           u" ****************************   Double Happiness   ****************************",
           u" ******************************************************************************",
           u" ",
           u"Hai! Welcome to Double Happiness.",
           u" ",]

    w = int(request.GET.get('pw', '80'))
    h = int(request.GET.get('ph', '24'))

    resp = HttpResponse(utils.json_encode({'status': 200,
                                           'issue': msg,
                                           'background': utils.load_random_background(w, h),
                                           }))
    resp.set_cookie('csrftoken', get_token(request))
    return resp

@utils.require_login
def motd(request):
    msg = [u" ",
           u"Oh, hi there. Good to see you.",
           u" "
           ]

    w = int(request.GET.get('pw', '80'))
    h = int(request.GET.get('ph', '24'))

    resp = {'status': 200,
            'motd': msg,
            'email': request.user.email,
            'background': utils.load_random_background(w, h),
           }
    pending_friends = models.Friend.objects.filter(recipient=request.user,
                                                   accepted_at__isnull=True,
                                                   revoked_at__isnull=True)

    if pending_friends.count():
        resp['pending_friends'] = [utils.friend_name(p.initiator) for p in pending_friends]

    return HttpResponse(utils.json_encode(resp))



###########
#  Auth-related functions
###########

def login(request):
    email = request.POST.get('email', None)
    password = request.POST.get('password', None)

    if email and password:
        try:
            username = User.objects.get(email=email).username
            user = auth.authenticate(username=username, password=password)
        except User.DoesNotExist:
            # TODO allocate unique username and create user account, fire welcome email, etc.
            user = None
            return HttpResponse(utils.json_encode({'status': 202,
                                                   'message': 'not found',
                                                   'email': email,
                                                   'password': password,
                                                   }))


        if user is not None:
            if user.is_active:
                auth.login(request, user)
                return HttpResponse(utils.json_encode({'status': 200,
                                     'email': user.email}))
            else:
                return HttpResponse(utils.json_encode({'status': 401,
                                                 'message': 'account not active'}))

    return HttpResponse(utils.json_encode({'status': 401,
                                     'message': 'login failed'}))

def verify(request):
    username = request.POST.get('token', None)
    password = request.POST.get('password', None)

    if username and password:
        user = auth.authenticate(username=username, password=password)
        if user:
            user.is_active = True
            user.save()
            auth.login(request, user)
            return HttpResponse(utils.json_encode({'status': 200,
                                                   'email': user.email}))

    return HttpResponse(utils.json_encode({'status': 401,
                                     'message': 'verify failed'}))

def register(request):
    email = request.POST.get('email', None)
    password = request.POST.get('password', None)

    if email and password:
        try:
            username = User.objects.get(email=email).username
            return HttpResponse(utils.json_encode({'status': 403,
                                             'message': 'already registered'}))
        except User.DoesNotExist:
            user = models.create_user(email, password)

            token_url = request.build_absolute_uri('/index.html') + "#register=%s" % user.username

            send_mail(_('Activate your Double Happiness Account'),
                      _("""
Thank you for joining Double Happiness.

Please click this link to activate your account.
  %s

We hope you will be delightfully happy.
""") % token_url,
                      'Double Happiness <dh@netjunky.com>',
                      [user.email],
                      fail_silently=False)

            return HttpResponse(utils.json_encode({'status': 201,
                                                   'message': 'registered',
                                                   'email': email,
                                                   }))

    return HttpResponse(utils.json_encode({'status': 401,
                                     'message': 'registration failed'}))


def logout(request):
    auth.logout(request)

    return HttpResponse(utils.json_encode({'status': 200,
                                           'message': 'logged out'}))


def passwd(request):
    old_pw = request.POST.get('current_password', None)
    new_pw = request.POST.get('replacement_password', None)

    if not old_pw or not new_pw:
        return HttpResponse(utils.json_encode({'status': 409,
                                         'message': 'need current and replacement passwords'}))

    if not check_password(old_pw, request.user.password):
        return HttpResponse(utils.json_encode({'status': 409,
                                         'message': 'current password incorrect'}))

    u = request.user
    u.set_password(new_pw)
    u.save()
    return HttpResponse(utils.json_encode({'status': 200,
                                         'message': 'password changed'}))

def chfn(request):
    first = request.POST.get('first_name', '')
    last = request.POST.get('last_name', None)

    if not first:
        return HttpResponse(utils.json_encode({'status': 409,
                                         'message': 'you need a name'}))

    u = request.user
    u.first_name = first
    u.last_name = last
    u.save()
    return HttpResponse(utils.json_encode({'status': 200,
                                         'message': 'you are now %s' % (utils.friend_name(request.user))}))


###########
#  Friend management functions
###########
@utils.require_login
def befriend(request):
    recipient_email = request.POST.get('email', None)
    if not recipient_email:
        return HttpResponse(utils.json_encode({'status': 409,
                                         'message': 'recipient email required'}))

    friend, created, invited = models.Friend.objects.request_friend(request.user, recipient_email)

    if invited:
        password = models.create_password()
        recipient = friend.recipient
        recipient.set_password(password)
        recipient.save()
        token_url = request.build_absolute_uri('/index.html') + "#register=%s" % recipient.username

        send_mail(_("You're Invited to Double Happiness"),
                  _("""
%s has invited you to be a BFF on Double Happiness!

Please click this link to activate your account.
  %s

Your temporary password to sign in is: %s

Once you've signed in, please use this command to accept their friendship:

  welcome %s


We hope you will be delightfully happy.
""") % (utils.friend_name(request.user), token_url, password, request.user.email),
                  'Double Happiness <dh@netjunky.com>',
                  [recipient.email],
                  fail_silently=False)

        return HttpResponse(utils.json_encode({'status': 200,
                                         'message': 'friend request sent'}))

    elif created:
        recipient = friend.recipient
        login_url = request.build_absolute_uri('/index.html')

        send_mail(_("New Friends on Double Happiness"),
                  _("""
%s has invited you to be a BFF on Double Happiness!

Please signed in:
  %s

Then use this command to accept their friendship:

  welcome %s


We hope you will be delightfully happy.
""") % (utils.friend_name(request.user), login_url, request.user.email),
                  'Double Happiness <dh@netjunky.com>',
                  [recipient.email],
                  fail_silently=False)

        return HttpResponse(utils.json_encode({'status': 200,
                                         'message': 'friend request sent'}))
    else:
        return HttpResponse(utils.json_encode({'status': 200,
                                         'message': 'friend request already sent'}))

@utils.require_login
def welcome(request):
    initiator_email = request.POST.get('email', None)
    if not initiator_email:
        return HttpResponse(utils.json_encode({'status': 409,
                                         'message': 'sender email required'}))

    if models.Friend.objects.accept_friend(request.user, initiator_email):
        return HttpResponse(utils.json_encode({'status': 200,
                                         'message': 'you are now friends with %s' % initiator_email}))
    else:
        return HttpResponse(utils.json_encode({'status': 409,
                                         'message': 'not possible'}))

@utils.require_login
def shun(request):
    return HttpResponse(utils.json_encode({'status': 501,
                                     'message': 'w not implemented'}))


###########
#  Content functions
###########
@utils.require_login
def status(request):
    status = request.POST.get('status', None)
    if not status:
        return HttpResponse(utils.json_encode({'status': 409,
                                         'message': 'status message required'}))

    s = models.Status()
    s.user = request.user
    s.status = status
    s.save()
    return HttpResponse(utils.json_encode({'status': 200,
                                     'message': 'status posted'}))

@csrf_exempt
@utils.require_login
def photo(request):
    # TODO csrf protect
    photo = utils.create_ascii_art(request)
    if photo:
        title = request.GET.get('title', '')
        s = models.Status()
        s.user = request.user
        s.status = title
        s.save()
        p = models.Photo()
        p.status = s
        p.image = '\n'.join(photo)
        p.save()

        return HttpResponse(utils.json_encode({'status': 200,
                                               'title': title,
                                               'photo': photo,
                                               }))
    else:
        return HttpResponse(utils.json_encode({'status': 409,
                                     'error': 'photo could not be processed'}))

@utils.require_login
def link(request):
    return HttpResponse(utils.json_encode({'status': 501,
                                     'message': 'w not implemented'}))

@utils.require_login
def poke(request):
    email = request.POST.get('email', None)
    if not email:
            return HttpResponse(utils.json_encode({'status': 409,
                                     'message': 'no friend of yours'}))

    if request.user.email == email:
        u = request.user
    else:
        f = models.Friend.objects.is_friend(request.user, email)
        if not f:
            return HttpResponse(utils.json_encode({'status': 409,
                                     'message': 'no friend of yours'}))
        u = f.subject(request.user)

    if not u:
        return HttpResponse(utils.json_encode({'status': 409,
                                 'message': 'no friend of yours'}))

    pokes = models.Poke.objects.filter(poker=request.user,
                               pokee=u,
                               poked_at__gte=datetime.datetime.now()-datetime.timedelta(hours=2))
    if pokes.count():
        return HttpResponse(utils.json_encode({'status': 403,
                                 'message': 'you just poked %s' % utils.friend_name(u)
                                 }))
    p = models.Poke()
    p.poker = request.user
    p.pokee = u
    p.save()

    login_url = request.build_absolute_uri('/index.html')

    send_mail(_("You've Been Poked on Double Happiness"),
                  _("""
%s has poked you on Double Happiness!

Hop online and see what's up.
  %s

We hope you will be delightfully happy.
""") % (utils.friend_name(request.user), login_url),
                  'Double Happiness <dh@netjunky.com>',
                  [u.email],
                  fail_silently=False)

    return HttpResponse(utils.json_encode({'status': 200,
                                     'message': 'consider them poked'}))

@utils.require_login
def message(request):
    return HttpResponse(utils.json_encode({'status': 501,
                                     'message': 'w not implemented'}))

@utils.require_login
def inbox(request):
    return HttpResponse(utils.json_encode({'status': 501,
                                     'message': 'w not implemented'}))

@utils.require_login
def read(request):
    return HttpResponse(utils.json_encode({'status': 501,
                                     'message': 'w not implemented'}))

@utils.require_login
def delete(request):
    return HttpResponse(utils.json_encode({'status': 501,
                                     'message': 'w not implemented'}))


###########
#  Multi-user info functions
###########

@utils.require_login
def w(request):
    users = [{'name': utils.friend_name(request.user),
              'last_login': request.user.last_login,
              'last_seen': models.Active.objects.last_seen(request.user)
             }]

    for f in models.Friend.objects.all_friends(request.user):
        u = f.subject(request.user)
        if u and models.Active.objects.is_online(u):
            last = models.Active.objects.last_seen(u)
            users.append({'name': utils.friend_name(u),
                          'last_login': u.last_login,
                         })

    users.sort(key=lambda u: u['name'])

    return HttpResponse(utils.json_encode({'status': 200,
                                     'people': users}))

@utils.require_login
def finger(request):
    email = request.POST.get('email', None)
    if not email:
            return HttpResponse(utils.json_encode({'status': 409,
                                     'message': 'no friend of yours'}))

    if request.user.email == email:
        u = request.user
    else:
        f = models.Friend.objects.is_friend(request.user, email)
        if not f:
            return HttpResponse(utils.json_encode({'status': 409,
                                     'message': 'no friend of yours'}))
        u = f.subject(request.user)

    if not u:
        return HttpResponse(utils.json_encode({'status': 409,
                                 'message': 'no friend of yours'}))

    # TODO add a 'last_status' field?
    data = {'status': 200,
            'last_login': u.last_login,
            'joined': u.date_joined,
            'online': models.Active.objects.is_online(u),
            'whom': utils.friend_name(u)}

    ss = u.statuses.all().order_by('-posted_at')
    if ss.count():
        data['last_status'] = ss[0].status
        data['last_status_at'] = ss[0].posted_at

    return HttpResponse(utils.json_encode(data))

@utils.require_login
def whoami(request):
    return HttpResponse(utils.json_encode({'status': 200,
                                     'response': utils.friend_name(request.user)}))

@utils.require_login
def last(request):
    email = request.POST.get('email', None)
    if email:
        if request.user.email == email:
            u = request.user
        else:
            f = models.Friend.objects.is_friend(request.user, email)
            if not f:
                return HttpResponse(utils.json_encode({'status': 409,
                                         'message': 'no friend of yours'}))
            u = f.subject(request.user)
        if not u:
            return HttpResponse(utils.json_encode({'status': 409,
                                     'message': 'no friend of yours'}))
        statuses = [{'friend': utils.friend_name(u),
                     'date': s.posted_at,
                     'status': s.get_status()
                     } for s in u.statuses.all().order_by('-posted_at')[:20]]

        return HttpResponse(utils.json_encode({'status': 200,
                                               'statuses': statuses,
                                               'whom': utils.friend_name(u)}))

    else:
        statuses = []
        ss = request.user.statuses.all().order_by('-posted_at')
        if ss.count():
            statuses.append({'friend': utils.friend_name(ss[0].user),
                             'date': ss[0].posted_at,
                             'status': ss[0].get_status()
                            })
        for f in models.Friend.objects.all_friends(request.user):
            u = f.subject(request.user)
            if u:
                ss = u.statuses.all().order_by('-posted_at')
                if ss.count():
                    statuses.append({'friend': utils.friend_name(ss[0].user),
                                     'date': ss[0].posted_at,
                                     'status': ss[0].get_status()
                                    })
        statuses.sort(key=lambda s: s['date'], reverse=True)
        print statuses
        return HttpResponse(utils.json_encode({'status': 200,
                            'statuses': statuses}))
