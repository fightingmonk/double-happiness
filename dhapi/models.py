import datetime
import random
import string

from django.db import models
from django.contrib.auth.models import User


class FriendManager(models.Manager):
    def request_friend(self, initiator, recipient_email):
        """ Creates a friend request if one doesn't already exist
          and returns a tuple of Friend, WasCreated, WasRecipientAccountAutoCreated
        """
        f = self.is_friend(initiator, recipient_email)
        if f:
            return f, False, False

        t = self.filter(  (models.Q(initiator=initiator) & models.Q(recipient__email=recipient_email))
                        | (models.Q(initiator__email=recipient_email) & models.Q(recipient=initiator)) )
        if t.count():
            return t[0], False, False

        f = Friend()
        f.initiator = initiator
        new_recipient = False
        try:
            f.recipient = User.objects.get(email=recipient_email)
        except User.DoesNotExist:
            f.recipient = create_user(recipient_email, create_password())
            new_recipient = True

        f.save()

        return f, True, new_recipient

    def accept_friend(self, recipient, initiator_email):
        """ Marks the indicated friend request as accepted.
            Only works for the recipient of the friend request.
            Returns True if friend record exists and is accepted.
        """
        t = self.filter( initiator__email=initiator_email, recipient=recipient )

        if t.count():
            t.update(revoked_at=None)
            t.update(accepted_at=datetime.datetime.now())
            return True

        return False

    def cancel_friend(self, user, subject_email):
        t = self.filter(  (  (models.Q(initiator=user) & models.Q(recipient__email=subject_email))
                           | (models.Q(initiator__email=subject_email) & models.Q(recipient=user)) )
                         & models.Q(accepted_at__isnull=False)
                        )
        if t.count():
            t.update(revoked_at=datetime.datetime.now())
            t.update(accepted_at=None)
            return True

        return False

    def is_friend(self, user, subject_email):
        t = self.filter( (  (models.Q(initiator=user) & models.Q(recipient__email=subject_email))
                          | (models.Q(initiator__email=subject_email) & models.Q(recipient=user)) )
                         & models.Q(accepted_at__isnull=False)
                       )
        return t[0] if t.count() == 1 else None

    def all_friends(self, user):
        return self.filter( (models.Q(initiator=user)|models.Q(recipient=user))
                           & models.Q(accepted_at__isnull=False)
                          )

# Create your models here.
class Friend(models.Model):
    initiator = models.ForeignKey(User, related_name='initiated_friends')
    recipient = models.ForeignKey(User, related_name='accepted_friends')
    requested_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, default=None)
    revoked_at = models.DateTimeField(null=True, default=None)

    objects = FriendManager()

    def subject(self, viewer):
        if viewer == self.initiator:
            return self.recipient
        elif viewer == self.recipient:
            return self.initiator

        return None

class Status(models.Model):
    user = models.ForeignKey(User, related_name='statuses')
    status = models.TextField()
    posted_at = models.DateTimeField(auto_now_add=True)

    def status_type(self):
        try:
            if self.photo.image:
                return 'photo'
        except Photo.DoesNotExist:
            pass

        return 'status'

    def get_status(self):
        try:
            if self.photo.image:
                return { 'type': 'photo',
                         'title': self.status,
                         'image': self.photo.image.split('\n'),
                }
        except Photo.DoesNotExist:
            pass

        return { 'type': 'status',
                 'status': self.status,
        }

class Photo(models.Model):
    status = models.OneToOneField(Status, related_name='photo')
    image = models.TextField()

class ActiveManager(models.Manager):
    def flag_user(self, user):
        try:
            a = self.get(user=user)
            a.save()
        except Active.DoesNotExist:
            a = Active()
            a.user = user
            a.save()

    def last_seen(self, user):
        try:
            a = self.get(user=user)
            return a.seen_at
        except Active.DoesNotExist:
            return None

    def is_online(self, user):
        when = self.last_seen(user)
        return (when and datetime.timedelta(minutes=1) > datetime.datetime.now()-when)


class Active(models.Model):
    user = models.OneToOneField(User, related_name='active')
    seen_at = models.DateTimeField(auto_now=True)

    objects = ActiveManager()


class Poke(models.Model):
    poker = models.ForeignKey(User, related_name='pokes')
    pokee = models.ForeignKey(User, related_name='poked_by')
    poked_at = models.DateTimeField(auto_now_add=True)


def create_user(email, password):
    username = None
    while not username:
        try:
            username = ''.join([random.choice(string.ascii_letters+string.digits) for i in range(30)])
            user = User.objects.create_user(username, email, password)
        except Exception, e:
            print repr(e)
            username = None

    user.is_active = False
    user.save()
    return user

def create_password():
    return "%s-%s-%s" % (random.choice(password_word_list),
                         random.choice(password_word_list),
                         random.choice(password_word_list))

password_word_list = """aardvark
abaci
aback
abacus
abaft
abalone
abandon
abandoned
abase
abash
abate
abatement
abatis
abattoir
abbacy
abbe
abbess
abbey
abbot
abbreviate
abbreviation
abc
abdias
abdicate
abdomen
abdominal
abduct
abeam
abecedarian
abed
aberrance
aberrancy
aberrant
aberrate
aberration
abet
abeyance
abeyant
abhor
abhorrent
abide
abidjan
ability
abject
abjure
ablate
ablative
ablaze
able
abloom
ablution
ably
abnegate
abnormal
aboard
abode
aboil
abolish
abolition
abolitionist
abominable
abominably
abominate
abomination
aboriginal
aborigine
aborning
abort
abortion
abortionist
abound
about
above
aboveboard
aboveground
abovementioned
abracadabra
abrade
abrasion
abrasive
abreact
abreast
abridge
abridgment
abroad
abrogate
abrupt
abscess
abscessed
abscissa
abscissae
abscond
abscound
absence
absent
absentee
absenteeism
absentminded
absinthe
absolute
absolution
absolutism
absolve
absorb
absorbency
absorbent
absorption
abstain
abstemious
abstention
abstinence
abstinent
abstract
abstraction
abstruse
absurd
abuilding
abundance
abundant
abuse
abut
abutment
abuttals
abysm
abysmal
abyss
ac
acacia
academe
academia
academic
academician
academicism
academy
acanthus
accede
accelerando
accelerate
accelerometer
accent
accentuate
accept
acceptable
acceptance
acceptation
access
accessible
accession
accessory
accidence
accident
accidental
accidentally
acclaim
acclamation
acclimate
acclimatise
acclimatize
acclivity
accolade
accommodate
accommodating
accommodation
accompanied
accompaniment
accompanist
accompany
accomplice
accomplish
accomplished
accomplishment
accord
accordance
according
accordingly
accordion
accost
account
accountable
accountant
accounting
accouter
accredit
accrete
accretion
accrue
acculturate
acculturation
accumulate
accuracy
accurate
accursed
accurst
accusal
accusative
accuse
accustom
accustomed
ace
acerbic
acerbity
acetanilide
acetate
acetic
acetone
acetylene
ache
achieve
achievement
achilles
aching
achromatic
acid
acidic
acidosis
acidulous
acknowledge
acknowledgment
acme
acne
acolyte
aconite
acorn
acoustic
acoustics
acquaint
acquaintance
acquiesce
acquiescence
acquire
acquirement
acquisition
acquisitive
acquit
acquitted
acre
acreage
acrid
acrimony
acrobat
acrobatics
acronym
acrophobia
acropolis
across
acrostic
acrylic
act
acting
actinic
actinium
action
actionable
activate
active
activist
activity
actor
actress
acts
actual
actually
actuary
actuate
acuity
acumen
acupuncture
acute
acyclic
ad
ada
adage
adagio
adamant
adapt
add
added
addend
addenda
addendum
adder
addict
addiction
addition
additional
additive
addle
address
addressee
adduce
adenoid
adept
adequacy
adequate
adhere
adherent
adhesion
adhesive
adieu
adieux
adios
adipose
adirondack
adjacency
adjacent
adjective
adjoin
adjoining
adjoint
adjourn
adjudge
adjudicate
adjunct
adjure
adjust
adjutant
adjuvant
adman
administer
administrable
administrate
administration
administrator
administratrix
admirable
admiral
admiralty
admire
admissibility
admissible
admission
admit
admittance
admix
admixture
admonish
admonition
admonitory
ado
adobe
adolescence
adolescent
adopt
adoptive
adorable
adore
adorn
adrenal
adrenaline
adriatic
adrift
adroit
adsorb
adsorption
adulate
adulation
adult
adulterant
adulterate
adulterer
adulteress
adulterous
adultery
adulthood
adumbrate
advance
advantage
advantaged
advent
adventitious
adventure
adventurer
adventuresome
adverb
adversary
adversative
adverse
adversity
advert
advertise
advertisement
advertising
advice
advisable
advise
advised
advisement
advisory
advocacy
advocate
adz
aegean
aegis
aeolian
aeon
aerate
aerial
aerialist
aerie
aero
aerobic
aerodrome
aerodynamic
aeronaut
aeronautic
aeronautics
aeropark
aeroplane
aerosol
aerospace
aery
aesthete
aesthetic
aesthetics
aestivate
afar
affable
affably
affair
affect
affectation
affected
affecting
affection
affectionate
afferent
affiance
affidavit
affiliate
affine
affinity
affirm
affirmative
affix
afflatus
afflict
afflictive
affluence
affluent
afford
afforest
affray
affricate
affright
affront
afghan
afghani
afghanistan
aficionado
afield
afire
aflame
afloat
aflutter
afoot
afore
aforehand
aforementioned
aforesaid
aforethought
afoul
afraid
afresh
africa
african
afro
aft
after
afterbirth
aftercare
afterdeck
aftereffect
afterglow
afterimage
afterlife
aftermarket
aftermath
afternoon
aftershock
aftertaste
afterthought
aftertime
afterward
afterwards
again
against
agape
agate
agave
age
aged
ageism
ageless
agency
agenda
agent
aggeus
agglomerate
agglutinate
aggrandise
aggrandize
aggravate
aggregate
aggregation
aggression
aggressive
aggressor
aggrieve
aghast
agile
agitate
agleam
aglitter
aglow
agnostic
ago
agog
agone
agonize
agony
agora
agoraphobia
agrarian
agree
agreeable
agreed
agreement
agribusiness
agriculture
agrimony
aground
ague
ah
aha
ahab
ahead
ahem
ahoy
ai
aid
aide
aigrette
ail
aileron
ailment
aim
aimless
aint
air
airbag
airborne
airbrush
aircraft
airdrome
airdrop
airfare
airfield
airflow
airfoil
airframe
airlift
airline
airliner
airlock
airmail
airman
airmass
airmen
airpark
airplane
airport
airpost
airship
airsick
airspace
airspeed
airstrip
airtight
airwave
airway
airworthy
airy
aisle
ajar
akimbo
akin
alabama
alabaman
alabamian
alabaster
alacrity
alarm
alarmist
alas
alaska
alaskan
alb
albacore
albania
albanian
albany
albatross
albeit
alberta
albino
album
albumen
albumin
albuminous
albuquerque
alcalde
alcazar
alchem
alchemy
alcohol
alcoholic
alcoholism
alcove
alder
alderman
aldermen
ale
alee
alehouse
alembic
aleph
alert
alewife
alewives
alexandria
alexandrine
alfalfa
alfresco
alga
algae
algal
algebra
algeria
algerian
algiers""".split('\n')
