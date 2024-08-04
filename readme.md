# TikMorph Demo (early prototype)

### About TikMorph
* TikMorph is an upcoming open-source TikTok live tool where you can customise every little thing to your liking, make your stream look like you want

### About the prototype
* It currently does not support overlays, that means you can't generate your own chat/gift/alert overlays to paste them in your streaming software. This is an early prototype, it was made to see how it could function and how stable it is.

* Stability - could be better, but for now it suits the needs since couple page refreshes don't hurt the experience to see is it working or no.

* Used repos
  * [TikTok-Chat-Reader by zerodytrash](https://github.com/zerodytrash/TikTok-Live-Connector/tree/main)
  * [TikTokWidgets by isaackogan](https://github.com/isaackogan/TikTokWidgets)

* What's next?
  * Add ability to actually generate overlays for a specific uniqueId to be able to paste it into your streaming software of choice
  * Fix stability issues and make a connection handler that checks if a user is currently LIVE or not, (if it disconnects or an error appears it should reconnect)


## Testing it yourself

1. Download a code editor like VSCode (this is a very important step)
2. Install [Node.js](https://nodejs.org/) on your system
3. Clone this repository or download and extract [this ZIP file](https://github.com/isaackogan/TikMorph/archive/refs/heads/master.zip)
4. Open a console/terminal in the root directory of the project
5. Enter `npm install` to install all required dependencies
6. Go to the public directory and change config.json uniqueId to yours or someone elses tiktok uniqueId without the @ so basically it should look like this "streamer" and not "@streamer"
7. Enter `node server.js` to start the application server

p.s if it doesn't load chats/gifts or alerts be sure to check the developer console for errors :)