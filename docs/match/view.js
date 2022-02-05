// Global ref to the Vue ViewModel instance
let data = {
  loaded: false,
  error: null,
  ispopup: !!window.opener,
  tab: "state",
  canvas_url: "/canvas/index.html",
  options: {},
  match:null,
  gameIndex:0,
  player:null,
  game_id:0,
  match_id:null
};

let match = null; // A raw js reference to match so it doesn't get Proxied by Vue

try {
  let urlOptions = location.search.replace(/^\?/,'');
  if (urlOptions) {
    data.options = JSON.parse(decodeURIComponent(urlOptions));
    if (data.options.game) {
      data.game_id =data.options.game;
    }
    if (data.options.match) {
      data.match_id = data.options.match;
    }
  }
}
catch(e) {
  console.log(e);
}

// A Reference to the canvas iframe
let canvas = null;

// Create a global match runner instance
let matchController = createMatchController();

// INIT
function ready() {
  if ($vm.loaded && canvas) {
    sendMessage("matchrunner/ready");
  }
}

// Init Vue

createVueApp(data,{
  methods: {
    select_tab: name=>{
      $vm.tab = name;
      resize_editors();
    },
    viewGame: i => {
      $vm.gameIndex = i;
      let logs = (match.output.logs && match.output.logs.length) ? match.output.logs[$vm.gameIndex] : [];
      matchController.view(match.output.state[$vm.gameIndex], logs);
    }
  }
}).then(async()=>{
  await init_monaco();

  // Attach resizers
  document.querySelectorAll('.resizer').forEach(function(ele) {
    resizable(ele, function() {
      resize_editors();
    });
  });

  // Init tabs
  Vue.nextTick(()=> {
    set_editor_value('state',{});
    set_editor_value('gamedirective',{});
    set_editor_value('results',{});
  });

  // Capture state edits and update the canvas immediately
  on_editor_change('state', function() {
    try {
      let state = editors['state'].getValue();
      if (state==="") { return; }
      sendMessage({state:JSON.parse(state)},canvas);
    } catch (e) {
      sendMessage({"error":"Invalid JSON in state. <br>"+e});
    }
  },500);

  ready();
});

// Receive Messages
addEventListener('message', async function(msg) {
  try {
    let data = msg.data;
    if (data === "canvas/ready") {
      canvas = document.getElementById('canvas');
      // Pass the canvas ready message out to the container
      ready();
    }
    if (data === "getstate") {
      let state = matchController.getState();
      return sendMessage({"type":"getstate","state":state});
    }
    else {
      // Message from containing page or from match runner
      // Message is a set of key/value pairs about what to do
      let canvas_message = {};
      let send_to_canvas = false;
      let start_match = false;

      for (let k in data) {
        if (!data.hasOwnProperty(k)) { continue; }
        let value = data[k];
        if (k==="game") {
          canvas_message.js = value.renderer_code;
          canvas_message.css = value.renderer_css;
          canvas_message.html = value.renderer_html;
          matchController.setGame(value.code);
          matchController.setPlayers([value.players[0].code, (value.players[1] ? value.players[1].code : value.players[0].code) ]);
          send_to_canvas = true;
        }
        else if (k==="players") {
          matchController.setPlayers(value);
        }
        else if (k==="gamecode") {
          matchController.setGame(value);
        }
        else if (k==="delay") {
          matchController.setDelay(value);
        }
        else if (k==="match") {
          $vm.match = value;
          match = value;
          // Reverse all the state arrays because the controller expects the last move at index 0
          value.output.state.forEach((s,i)=>{
            value.output.state[i] = s.reverse();
          });
          $vm.gameIndex=0;
          let logs = (value.output.logs && value.output.logs.length) ? value.output.logs[$vm.gameIndex] : [];
          matchController.view(value.output.state[$vm.gameIndex], logs);
          Vue.nextTick(()=>{
            resize_editors();
          });
        }
        else if (k==="startMatch" && value) {
          start_match = true;
        }
        else if (k==="js" || k==="css" || k==="html" || k==="state") {
          canvas_message[k] = value;
          send_to_canvas = true;
        }
      }
      if (send_to_canvas) {
        sendMessage(canvas_message, canvas);
      }
      // Last but not least, if we need to start a match do it
      if (start_match) {
        await play(true);
      }
    }
  } catch (e) {
    if ($vm) {
      sendMessage("matchrunner/error");
      $vm.error = e;
    }
  }
});

// Either continue currently-paused game or start a new one
async function play(restart=false) {
  try {
    if ($vm) {
      $vm.error = null;
      $vm.newerror = false;
    }
    if (match) {
      await matchController.replay();
    }
    else {
      await matchController.start(restart);
    }
  } catch (e) {
    if ($vm) {
      $vm.error = e;
      $vm.newerror = true;
    }
  }
}
// Detect window close and tell the controller window about it
addEventListener('beforeunload', function (e) {
  if (window.opener) {
    sendMessage("matchrunner/popin", opener);
  }
});

function popout() {
  sendMessage("matchrunner/popout");
}
