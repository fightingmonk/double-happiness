from django.conf.urls.defaults import patterns, include, url


urlpatterns = patterns('dhapi.views',
    url(r'^ping/', 'ping'),
    url(r'^issue/', 'issue'),
    url(r'^motd/', 'motd'),

    url(r'^login/', 'login'),
    url(r'^register/', 'register'),
    url(r'^verify/', 'verify'),
    url(r'^logout/', 'logout'),

    url(r'^passwd/', 'passwd'),
    url(r'^chfn/', 'chfn'),

    url(r'^befriend/', 'befriend'),
    url(r'^welcome/', 'welcome'),
    url(r'^shun/', 'shun'),

    url(r'^status/', 'status'),
    url(r'^photo/', 'photo'),
    url(r'^poke/', 'poke'),
    url(r'^message/', 'message'),
    url(r'^link/', 'link'),
    url(r'^inbox/', 'inbox'),
    url(r'^read/', 'read'),
    url(r'^delete/', 'delete'),

    url(r'^w/', 'w'),
    url(r'^finger/', 'finger'),
    url(r'^whoami/', 'whoami'),
    url(r'^last/', 'last'),

)
