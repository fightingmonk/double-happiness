import re
import os
import subprocess
from urllib import urlencode
import urllib2
import urlparse
from datetime import datetime, timedelta
import base64
import hashlib
import hmac
import logging
import tempfile
import Image

from django.conf import settings
from django.utils import simplejson
from django.http import HttpResponse, HttpResponseRedirect
from django.contrib import messages

def load_random_background(width=80, height=24):
    path = os.path.dirname(os.path.abspath(__file__))
    pic_path = os.path.join(path, "media", "gingko-sm.jpg")

    pic_data = subprocess.Popen(['jp2a',
                                 '--width=%d' % width,
                                 '-i',
                                 pic_path],
                                stdout=subprocess.PIPE).communicate()[0]

    return pic_data.split('\n')

def create_ascii_art(request):
    """
        read an image from request.read() and convert it to ascii art, returning a sequence of ascii scanlines.
    """
    try:
        basename, extension = os.path.splitext(request.GET['qqfile'])
        th, tfile = tempfile.mkstemp(suffix=extension)
        os.write(th, request.raw_post_data)
        os.close(th)

        im = Image.open(tfile)
        im.thumbnail((78, 66))
        tout = tfile.replace(extension, '.thmb')
        im.save(tout, "JPEG")
        os.remove(tfile)


        pic_data = subprocess.Popen(['jp2a',
                                     '--width=%d' % 78,
                                     #'-i',
                                     tout],
                                    stdout=subprocess.PIPE).communicate()[0]
        os.remove(tout)
        return pic_data.split('\n')
    except IOError, e:
        print repr(e)
        return None

def friend_name(user):
    v = []
    if user.first_name: v.append(user.first_name)
    if user.last_name: v.append(user.last_name)
    if user.email: v.append("<"+user.email+">")
    return " ".join(v)

def json_encode(data):
    """Convert structured data into JSON-notation"""
    return simplejson.dumps(data,
                      ensure_ascii=False,
                      default=lambda obj: obj.isoformat() if isinstance(obj, datetime) else None
                     )

def json_decode(text):
    """Convert a string containing JSON-notation into structured data"""
    return simplejson.loads(text)

def check_login(request):
    """Return the currently authenticated user, if any."""
    if request.user.is_authenticated():
        return request.user
    return None

def base64_url_encode(inp):
    return base64.b64encode(inp).strip('=')

def base64_url_decode(inp):
    """A base64 decoder that doesn't mind if our data is not padded to n*4 chars"""
    padding_factor = (4 - len(inp) % 4) % 4
    inp += "="*padding_factor
    return base64.b64decode(unicode(inp).translate(dict(zip(map(ord, u'-_'), u'+/'))))

def sign_string(value, secret):
    return base64_url_encode(hmac.new(secret, msg=value, digestmod=hashlib.sha256).digest())

def parse_signed_request(signed_request, secret):
    """
        Parse a signed request returned from Facebook and verify the
        included signature matches our configured Facebook API secret
    """
    l = signed_request.split('.', 2)
    encoded_sig = l[0]
    payload = l[1]

    sig = base64_url_decode(encoded_sig)
    data = simplejson.loads(base64_url_decode(payload))

    if data.get('algorithm').upper() != 'HMAC-SHA256':
        log.error('Unknown algorithm')
        return None
    else:
        expected_sig = hmac.new(secret, msg=payload, digestmod=hashlib.sha256).digest()

    if sig != expected_sig:
        return None
    else:
        return data

def rsa_encrypt_string(message):
    """Encrypt a string using an RSA public key"""
    pub_key = settings.RSA_PUBLIC_KEY
    from M2Crypto import RSA, BIO
    bio = BIO.MemoryBuffer(pub_key)
    rsa = RSA.load_pub_key_bio(bio)
    encrypted = rsa.public_encrypt(message, RSA.pkcs1_oaep_padding)
    return encrypted.encode('base64')


def simple_decorator(decorator):
    """This decorator can be used to turn simple functions
    into well-behaved decorators, so long as the decorators
    are fairly simple. If a decorator expects a function and
    returns a function (no descriptors), and if it doesn't
    modify function attributes or docstring, then it is
    eligible to use this. Simply apply @simple_decorator to
    your decorator and it will automatically preserve the
    docstring and function attributes of functions to which
    it is applied."""
    def new_decorator(f):
        g = decorator(f)
        g.__name__ = f.__name__
        g.__doc__ = f.__doc__
        g.__dict__.update(f.__dict__)
        return g
    # Now a few lines needed to make simple_decorator itself
    # be a well-behaved decorator.
    new_decorator.__name__ = decorator.__name__
    new_decorator.__doc__ = decorator.__doc__
    new_decorator.__dict__.update(decorator.__dict__)
    return new_decorator

@simple_decorator
def require_login(view_func):
    def _trap_request(request,  *args, **kwargs):
        user = check_login(request)
        if user:
            return view_func(request,  *args, **kwargs)
        else:
            return HttpResponse(json_encode({'status': 401,
                                             'message': 'not logged in'}))

    return _trap_request
