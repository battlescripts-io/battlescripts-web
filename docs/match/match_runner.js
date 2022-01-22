/*
Sets a global MatchRunner object that is used to ccreate, mount, update, and control a match-running iframe.
This is the integration point for other pages.
 */
const MatchRunner = (function() {

  let createInstance = function(userOptions) {
    let poppedOut = false;
    let contentWindow = null;
    let iframe = null;
    let ready = false;
    let options = {
      mode: "edit", // edit|view
      showPopoutLink: true,
      showInspectorPanel: true,
      showStateInspectorTab: true,
      showGameDirectiveInspectorTab: true,
      showMoveInspectorTab: true,
      showResultsInspectorTab: true,
      showLogInspectorTab: true,
      split: 50,
      orientation: "auto",
      density: "auto" // compact
    };

    // Apply some logic to options
    if (userOptions) {
      Object.assign(options, userOptions.options);
    }
    // If not displaying inspector panel, adjust flex
    if (!options.showInspectorPanel) {
      options.split = 100;
    }

    // Renderer and Game config sent by containing page.
    // This is always the most recent version, over-written with each update, so if
    // the user pops in/out, we can still init with the latest copy
    let latestUpdate = null;

    // Receive messages from the containing page and the canvas iframe
    addEventListener('message', function (msg) {
      // Only process messages from our window
      if (!msg || !msg.source || !contentWindow || msg.source !== contentWindow) {
        return false;
      }
      let data = msg.data;
      let type;
      if (data) {
        type = data.type;
      }
      if ("matchrunner/ready" === data) {
        // canvas iframe is loaded and ready, let's run
        ready = true;
        applyFullUpdate();
      } else if ("matchrunner/popout" === data) {
        // A request from the runner to pop out into a window
        contentWindow = window.open('/match/view.html?' + encodeURIComponent(JSON.stringify(options)), 'battlescripts-match', 'menubar=0,location=0,resizable=yes,scrollbars=0,status=yes');
        iframe.style.display = "none";
        poppedOut = true;
        ready = false;
        if (typeof api.onpopout == "function") {
          api.onpopout();
        }
      } else if ("matchrunner/popin" === data) {
        iframe.style.display = "block";
        contentWindow = iframe.contentWindow;
        poppedOut = false;
        applyFullUpdate();
        if (typeof api.onpopin == "function") {
          api.onpopin();
        }
      } else if ("matchrunner/error" === type) {
        if (typeof api.onerror == "function") {
          api.onerror(data.data);
        }
      } else if ("matchrunner/gameover" === type) {
        if (typeof api.ongameover == "function") {
          api.ongameover(data.data);
        }
      }
    });

    const applyFullUpdate = () => {
      if (ready && latestUpdate) {
        sendMessage(latestUpdate, contentWindow);
      }
    };
    const applyIncrementalUpdate = (update) => {
      Object.assign(latestUpdate, update);
      if (ready) {
        sendMessage(update, contentWindow);
      }
    };

    let createIframe = (el, options) => {
      if (el && el.appendChild) {
        iframe = document.createElement('iframe');
        iframe.src = "/match/view.html?" + encodeURIComponent(JSON.stringify(options));
        iframe.id = "matchRunner";
        iframe.style.height = "100%";
        iframe.style.width = "100%";
        el.appendChild(iframe);
        return iframe.contentWindow;
      }
    };

    // Return the instance api
    let api = {

      // Let containing page catch the pop out/in events and do something
      onpopout: null,
      onpopin: null,
      ongameover: null,
      onerror: null,

      // Expose some stuff
      options: options,

      mount: (selector)=>{
        let el = document.querySelector(selector);
        contentWindow = createIframe(el, options);
      },
      update: (config) => {
        if (!config) return;
        if (!latestUpdate) latestUpdate = {};
        applyIncrementalUpdate(config);
      },
      set: (key,value) => {
        api.update({[key]:value});
      },
      start: ()=>{
        api.update({startMatch:true});
      },

      // A specific update API instead of just calling update() for everything

      // Set a full game config in one call - renderer, code, etc
      setGame: (game)=>{
        api.set("game",game);
      },
      setGameCode: (code)=>{
        api.set("gamecode",code);
      },
      setPlayers: (players)=>{
        api.set("players",players);
      },
      setDelay: (n)=>{
        api.set("delay",n);
      },

      // Other methods
      getState: async()=>{
        let response = receiveMessageOnce("getstate");
        sendMessage("getstate", contentWindow);
        return response.then(data=>{
          return data.state;
        });
      }

    };

    // Mount it
    if (userOptions.mount) {
      api.mount(userOptions.mount);
    }

    return api;

  };

  // Return the external MatchRunner api

  return {

    // Create an interactive match runner
    create: (userOptions) => {
      if (!userOptions) return;
      return createInstance(userOptions);
    },

    // Create an instance specifically for viewing games that are done
    createViewer: (userOptions={}) => {
      // TODO: Set some default options specific to view-only mode
      userOptions.mode="view";
      userOptions.options={};
      userOptions.options.showGameDirectiveInspectorTab=false;
      userOptions.options.showMoveInspectorTab=false;
      userOptions.options.showResultsInspectorTab=false;
      userOptions.options.density = "compact";

      let instance = createInstance(userOptions);
      instance.set("mode","view");
      instance.setMatch = (match) => {
        instance.update({
          match:match
        })
      };
      return instance;
    }

  };

})();
