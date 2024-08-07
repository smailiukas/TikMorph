// For checking and not playing alert sounds when they're not needed (since it can get hella annoying ffs)
let soundMode = false;
let statsMode = false;

// Needed variables that shouldn't be documented but whatever
const followed = {}
let viewerCount = 0;
let likeCount = 0;
let diamondsCount = 0;


// Demo code so I wouldn't forget to add this part later on
function generateOverlay() {
    alert("This version of TikMorph does not support overlays yet :(");
}

function updateRoomStats() {
    $('#roomStats').html(`Viewers: <b>${viewerCount.toLocaleString()}</b> Likes: <b>${likeCount.toLocaleString()}</b> Earned from gifts: <b>${diamondsCount.toLocaleString()}</b>`)
}

/**
 * Wrapper for client-side TikTok connection over Socket.IO
 * With reconnect functionality.
 */
class TikTokIOConnection {
    constructor(backendUrl) {
        this.socket = io(backendUrl);
        this.uniqueId = null;
        this.options = null;

        this.socket.on('connect', () => {
            Logger.DEBUG("Socket connected!");

            // Reconnect to streamer if uniqueId already set
            if (this.uniqueId) {
                this.setUniqueId();
            }
        })

        this.socket.on('disconnect', () => {
            Logger.DEBUG("Socket disconnected!");
        })

        this.socket.on('streamEnd', () => {
            Logger.DEBUG("LIVE has ended!");
            this.uniqueId = null;
        })

        this.socket.on('tiktokDisconnected', (errMsg) => {
            Logger.WARNING(errMsg);
            if (errMsg && errMsg.includes('LIVE has ended')) {
                this.uniqueId = null;
            }
        });
    }

    connect(uniqueId, options) {
        this.uniqueId = uniqueId;
        this.options = options || {};

        this.setUniqueId();

        return new Promise((resolve, reject) => {
            this.socket.once('tiktokConnected', resolve);
            this.socket.once('tiktokDisconnected', reject);

            setTimeout(() => {
                reject('Connection Timeout');
            }, 15000)
        })
    }

    setUniqueId() {
        this.socket.emit('setUniqueId', this.uniqueId, this.options);
    }

    on(eventName, eventHandler) {
        this.socket.on(eventName, eventHandler);
    }
}

let connection = new TikTokIOConnection();

function loadData(type) {
    connection.socket.emit('requestData', { type: type });
}

/**
 * Very junky code and it must be fixed asap (this was an option to get the prototype up and working)
 */
connection.socket.on('responseData', (data) => {
    const content = document.getElementById('content');
    switch(data) {
        case "Alerts Data": {
            soundMode = true;
            statsMode = false;
            content.innerHTML = `
            <h1>Preview</h1><br>
            <div class="mainContainer">
                <div class="current"></div>
            </div>
            `;
            break;
        }
        case "USER_SETUP": {
            soundMode = false;
            statsMode = false;
            content.innerHTML = `<h1>Enter username</h2>`
            break;
        }
        case "TikTok Chat & Gifts Data": {
            soundMode = false;
            statsMode = true;
            content.innerHTML = `<table class="splitchattable">
            <tr>
                <td>
                    <div class="chatcontainer">
                        <h3 class="containerheader">
                        Live Chat
                        <a href="#" onclick="generateOverlay()">Generate Overlay URL</a>
                        </h3>
                    </div>
                    <div class="messages-received"></div>
                </td>
                <td>
                    <div class="giftcontainer">
                        <h3 class="containerheader">
                        Gifts
                        <a href="#" onclick="generateOverlay()">Generate Overlay URL</a></h3>
                    </div>
                    <div class="gifts-received"></div>
                </td>
            </tr>
        </table>
        <div style="margin-top: 1px; background-color: #121212; padding: 10px; border-radius: 5px;">
            <h2 style="color: white;">Stream statistics</h3>
            <div id="roomStats">Waiting for data..</div>
        </div>`;
            break;
        }
    }
});


let Config = {
    firstConnect: true,
    updateConfig() {

        fetch("/config.json").then((response) => response.json()).then((json) => {
            Config = Object.assign({}, Config, json);

            if (this.firstConnect) {
                Logger.INFO("Connecting to %s...", Config["uniqueId"]);
                connection.connect(Config["uniqueId"], {enableExtendedGiftInfo: true})
                    .then(state => {
                        Logger.INFO("Connected to roomId %s", state["roomId"])

                        // reset stats
                        viewerCount = 0;
                        likeCount = 0;
                        diamondsCount = 0;
                        updateRoomStats();

                        connection.on("subscribe", (data) => {

                            if (!Config["enabled"]["subscribe"]) {
                                return;
                            }
                        
                            let announcement = new Announcement(
                                data["uniqueId"],
                                data["profilePictureUrl"],
                                `just subscribed!`,
                                Config["sounds"]["subscribe"] || null,
                                true
                            )
                        
                            $(".current").replaceWith(announcement.build());
                            if(soundMode) announcement.sound();
                        
                        })

                        // viewer stats
                        connection.on('roomUser', (msg) => {
                            if (typeof msg.viewerCount === 'number') {
                                viewerCount = msg.viewerCount;
                                updateRoomStats();
                            }
                        })
                        
                        // like stats
                        connection.on('like', (msg) => {
                            if (typeof msg.totalLikeCount === 'number') {
                                likeCount = msg.totalLikeCount;
                                updateRoomStats();
                            }
                        
                            if (typeof msg.likeCount === 'number') {
                                addChatItem('#447dd4', msg, msg.label.replace('{0:user}', '').replace('likes', `${msg.likeCount} likes`))
                            }
                        })
                        
                        // Member join
                        let joinMsgDelay = 0;
                        connection.on('member', (msg) => {
                            let addDelay = 250;
                            if (joinMsgDelay > 500) addDelay = 100;
                            if (joinMsgDelay > 1000) addDelay = 0;
                        
                            joinMsgDelay += addDelay;
                        
                            setTimeout(() => {
                                joinMsgDelay -= addDelay;
                                addChatItem('#21b2c2', msg, 'joined', true);
                            }, joinMsgDelay);
                        })
                        
                        // New chat comment received
                        connection.on('chat', (msg) => {
                            addChatItem('', msg, msg.comment);
                        })
                        
                        // New gift received
                        connection.on('gift', (data) => {
                            if (!Config["enabled"]["gift"]) {
                                return;
                            }
                        
                            if (data["giftType"] === 1 && !data["repeatEnd"]) {
                                return;
                            }
                        
                            let announcement = new Announcement(
                                data["uniqueId"],
                                data["giftPictureUrl"],
                                `sent ${data["repeatCount"]}x ${data["giftName"]}`,
                                Config["sounds"]["gift"][data["giftName"].toLowerCase()] || Config["sounds"]["gift"]["default"]
                            );
                        
                            $(".current").replaceWith(announcement.build());
                            if(soundMode) announcement.sound();
                            
                            if (!isPendingStreak(data) && data.diamondCount > 0) {
                                diamondsCount += (data.diamondCount * data.repeatCount);
                            }
                        
                            addGiftItem(data);
                        })
                        
                        // share, follow
                        connection.on('social', (data) => {
                            if (!Config["enabled"]["follow"]) {
                                return;
                            }
                        
                            if (!data["displayType"].includes("follow")) {
                                return;
                            }
                        
                            if (followed[data["uniqueId"]] && Config["firstFollowOnly"]) {
                                return;
                            }
                        
                            followed[data["uniqueId"]] = true;
                        
                            let announcement = new Announcement(
                                data["uniqueId"],
                                data["profilePictureUrl"],
                                `followed!`,
                                Config["sounds"]["follow"] || null,
                                true
                            );
                        
                            $(".current").replaceWith(announcement.build());
                            if(soundMode) announcement.sound();
                        
                            let color = data.displayType.includes('follow') ? '#ff005e' : '#2fb816';
                            addChatItem(color, data, data.label.replace('{0:user}', ''));
                        })
                    })
                    .catch(errorMessage => Logger.ERROR("Failed to connect: \n\n %s", errorMessage));
                this.firstConnect = false;
            }

            setTimeout(Config.updateConfig, 1000);

        });
    }

}

Config.updateConfig();

// Alert animation class
class Announcement {

    #uniqueId;
    #imageUrl;
    #message;
    #soundUrl;
    #circleCrop;

    constructor(uniqueId, imageUrl, message, soundUrl, circleCrop = false) {
        this.#uniqueId = uniqueId;
        this.#imageUrl = imageUrl;
        this.#message = message;
        this.#soundUrl = soundUrl;
        this.#circleCrop = circleCrop;
    }

    static #getAnimatedLetters(name, _html = "") {

        for (let letter of name.split("")) {
            _html += `<span class="animated-letter wiggle" style="color: ${Config["nameColour"]}; white-space: nowrap;">${letter}</span>`
        }

        return _html;

    }

    build() {

        return `
            
            <div class="alertContainer current" style="
                animation: fadein ${Config["fadeIn"] || 0}ms, fadeout ${Config["fadeOut"] || 0}ms; 
                animation-delay: 0ms, ${Config["fadeAfter"]}ms;
                animation-fill-mode: forwards;
                font-size: ${Config["fontSize"] + "px"};
                white-space: nowrap;
                padding: 20px;
            ">
                <img class="alertImage" src="${this.#imageUrl}" alt="Image" style="border-radius: "15px"/>
                <span class="alertText" style="
                    font-weight: ${Config["fontWeight"]};
                    white-space: nowrap;
                    color: ${Config["textColour"] + 'px'};
                ">
                    ${Announcement.#getAnimatedLetters(this.#uniqueId)} ${this.#message}
                </span>
            </div>
        
        `
    }

    sound() {

        if (!this.#soundUrl) {
            return;
        }

        let audio = new Audio(this.#soundUrl);
        audio.volume = Config["volume"];
        audio.play().catch();

    }


}

// Needed functions that were forked for temporary use (why should you rewrite a new thing if it already exists)

// Prevent Cross site scripting (XSS)
function sanitize(text) {
    return text.replace(/</g, '&lt;')
}

function generateUsernameLink(data) {
    return `<a class="usernamelink" href="https://www.tiktok.com/@${data.uniqueId}" target="_blank">${data.uniqueId}</a>`;
}

function isPendingStreak(data) {
    return data.giftType === 1 && !data.repeatEnd;
}

/**
 * Add a new message to the chat container
 */
function addChatItem(color, data, text, summarize) {
    let container = $('.messages-received');

    // if (container.find('div').length > 25) {
    //     container.find('div').slice(0, 1).remove();
    // }

    container.find('.temporary').remove();

    container.append(`
        <div class=${summarize ? 'temporary' : 'static'}>
            ${text === "joined" ? `<div style="margin-right: 5px; background-color: #282c34; width: 20px; height: 20px; display: flex; justify-content: center; align-items: center; border-radius: 50%;"><img style="width: 60%; height: 60%;" src="./assets/svgs/entry.svg"></div>` : `<img class="profileIcon" src="${data.profilePictureUrl}">`}
            <span>
                <b>${generateUsernameLink(data)}:</b> 
                <span class="message-text">${sanitize(text)}</span>
            </span>
        </div>
    `);

    container.stop();
    if(statsMode) {
        container.animate({
            scrollTop: container[0].scrollHeight
        }, 400);
    }
}

/**
 * Add a new gift to the gift container
 */
function addGiftItem(data) {
    let container = $('.gifts-received');


    let streakId = data.userId.toString() + '_' + data.giftId;

    let html = `
        <div data-streakid=${isPendingStreak(data) ? streakId : ''}>
            <img class="profileIcon" src="${data.profilePictureUrl}">
            <span>
                <b>${generateUsernameLink(data)}:</b> <span>${data.uniqueId}</span><br>
                <div>
                    <table>
                        <tr>
                            <td><img class="gifticon" src="${data.giftPictureUrl}"></td>
                            <td>
                                <span>Name: <b>${data.giftName}</b> (ID:${data.giftId})<span><br>
                                <span>Repeat: <b style="${isPendingStreak(data) ? 'color:red' : ''}">x${data.repeatCount.toLocaleString()}</b><span><br>
                                <span>Cost: <b>${(data.diamondCount * data.repeatCount).toLocaleString()} Diamonds</b><span>
                            </td>
                        </tr>
                    </tabl>
                </div>
            </span>
        </div>
    `;

    let existingStreakItem = container.find(`[data-streakid='${streakId}']`);

    if (existingStreakItem.length) {
        existingStreakItem.replaceWith(html);
    } else {
        container.append(html);
    }

    container.stop();
    if(statsMode) {
        container.animate({
            scrollTop: container[0].scrollHeight
        }, 800);
    }
}
