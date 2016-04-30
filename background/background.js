// User settings
var userInfo = null;

/* 

Information about dramas being tracked today
{
    "http://urlOfDrama": {
        url: string,
        episode: integer,
    }
}

*/

var currentDramasInfo = {};

// Begin tracking dramas airing today on startup
$(function() { 
    updateDramaTracking();

    // Set alarm to check for updates periodically
    chrome.alarms.onAlarm.addListener(function(alarm) {
        var url = alarm.name;
        getDramaUpdates(url);
    });

    // Set listener for any user settings updates
    chrome.runtime.onMessage.addListener(function(request) {
        if (request == SETTINGS_UPDATED_MSG) {
            updateDramaTracking();            
        }
    });

    // Set listener for "Watch now" button
    chrome.notifications.onButtonClicked.addListener(function(id, buttonIndex) {
        var dramaInfo = currentDramasInfo[id];

        // "Watch Now" button clicked
        if (buttonIndex == 0) {
            // Open tab for current episode and set episode as watched
            goToUrl(dramaInfo.url);
            setWatchedEp(id, dramaInfo.episode);

            // Clear tracking for this drama
            chrome.notifications.clear(id);
            chrome.alarms.clear(id);

        // "Mute Notifications" button clicked
        } else if (buttonIndex == 1) {
            // Clear tracking for this drama
            chrome.notifications.clear(id);
            chrome.alarms.clear(id);
        }
    });
});

// Get updated settings and update tracking of dramas
function updateDramaTracking() {
    console.log("Tracking");

    // Clear all previous alarms
    chrome.alarms.getAll(function(alarms) {
        for (i = 0; i < alarms.length; i++) {
            var alarmName = alarms[i].name;
            chrome.alarms.clear(alarmName);
        }
    });

    // Get updated settings
    userInfo = localStorage.DramaTracker ? JSON.parse(localStorage.DramaTracker) : defaultSettings;
    var airingToday = getDramasAiringToday();

    // Set up periodic polling for drama updates
    for (i = 0; i < airingToday.length; i++) {
        var url = airingToday[i];   
        chrome.alarms.create(url, { 
           periodInMinutes: userInfo.settings.updateFrequency
        });
    }
}

// Determine which dramas are airing today
function getDramasAiringToday() { 
    var today = (new Date()).getDay();
    var dramaUrls = userInfo.dramaUrls;

    var airingToday = [];

    for (var url in dramaUrls) {
        var airDays = dramaUrls[url].airDays;

        for (var i = 0; i < airDays.length; i++) {
            if (airDays[i] == today) {
                airingToday.push(url);
            }
        }
    }

    return airingToday;
}

// Generate notifications based on selected frequency
function createNotification(drama, messageBody) {
    var opt = {
        type: "basic",
        title: drama.name,
        message: messageBody,
        iconUrl: drama.image,
        isClickable : false,
        buttons: [{
            title: "Watch Now"
        }, {
            title: "Mute Notifications"
        }]
    };
    
    chrome.notifications.create(drama.url, opt);

    // Update the drama's current URL and episode number
    currentDramasInfo[drama.url] = { 
        url: drama.currentUrl,
        episode: drama.currentEp
    };
}

// Get drama details and check for updates
function getDramaUpdates(url) {
    scrapeDrama(url, function(drama) {
        console.log("Checking updates");
        var lastWatched = userInfo.dramaUrls[url] ? userInfo.dramaUrls[url].lastWatched : null;

        // Only show notification for a new episode
        if (!lastWatched || drama.currentEp > lastWatched) {
            drama.url = url;

            console.log(drama.name + ": " + drama.currentSubs + " at " + (new Date()).toTimeString());

            switch (drama.site) {
                case MYASIANTV:
                    if (drama.currentSubs == SUB) {
                        createNotification(drama, buildNotificationMessage(drama.currentEp));
                    }
                    break;
                case VIKI:
                    var subsPercent = parseInt(drama.currentSubs.match('[0-9]+')[0]);
                    if (subsPercent >= userInfo.settings.minSubs) {
                        createNotification( drama, buildNotificationMessage(drama.currentEp, drama.currentSubs));
                    }
                    break;
            }                
        }
    });
}

function buildNotificationMessage(episodeNumber, subs) {
    subs = subs ? subs + " subbed!" : "subbed!";
    return "Episode " + episodeNumber + " is " + subs;
}
