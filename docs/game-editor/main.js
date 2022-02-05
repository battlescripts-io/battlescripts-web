// Pre-define data attributes so Vue can detect changes
let data = {
  loaded: false,
  view: "docs-howto-game",
  popout: false,
  game: {},
  selectedTestPlayer: 0,
  originalStringifiedGame: null,
  dirty:false,
  settings: {
    run_on_change: true,
    delay:0
  }
};

// Init Vue
createVueApp(data, {
  methods: {
    file: (name,index) => {
      $vm.view = name;
      if (typeof index!="undefined") {
        $vm.selectedTestPlayer=index;
      }
      // Specific logic for selecting test players
      if (name=='game-players') {
        // Set the player editor content
        set_editor_value('game-player-editor', $vm.game.players[$vm.selectedTestPlayer].code);
      }
      resize_editors();
    },
    addPlayer: ()=>{
      $vm.game.players.push({name:"Test Opponent",code:""});
      $vm.selectedTestPlayer = $vm.game.players.length-1;
      $vm.view = "game-players";
    },
    deletePlayer: (index)=>{
      let players = $vm.game.players;
      if (confirm("Delete this player?")) {
        players.splice(index,1);
        $vm.selectedTestPlayer--;
        if ($vm.selectedTestPlayer<0) {
          $vm.selectedTestPlayer=0;
        }
      }
    }
  },
  computed: {
    saved_ago() {
      return ago(this.game?this.game.updated_on:this.now, this.now);
    }
  },
  watch: {
    game: {
      handler(newValue, oldValue) {
        if (this.originalStringifiedGame==null) {
          this.originalStringifiedGame = JSON.stringify(newValue);
        }
        else {
          this.dirty = (JSON.stringify(newValue)!=this.originalStringifiedGame)
        }
      },
      deep:true
    }
  }
},init);

let matchRunner = null;

async function init() {
  overlay("Loading...");

  let id = document.location.hash.replace(/^#/,'');
  let game;

  if (id!==null && typeof id!=="undefined" && id!=="") {
    let user = await API.getUser();
    if (!user) {
      login_overlay("to edit a game");
      API.onLogin(()=>{
        location.reload(true);
      });
      return;
    }
    try {
      game = await API.getGame(id);
    } catch(e) {
      console.log(e);
    }
    $vm.view = "game-info";
  }
  if (!game) {
    game = await API.getGameTemplate();
  }
  $vm.game = game;

  // If a game doesn't have defined players, put in an empty one
  if (!game.players) {
    game.players = [
      {name:"Default",code:""}
    ];
  }

  // Configure the matchRunner display area
  matchRunner = MatchRunner.create({
    mount:'#match-runner-view'
  });
  // Listen for the match runner being popped into a window
  matchRunner.onpopout =function() {
    $vm.popout = true;
  };
  // Listen for match runner window being closed
  matchRunner.onpopin =function() {
    $vm.popout = false;
  };
  matchRunner.setGame(game);

  await init_monaco();

  // Attach resizers
  document.querySelectorAll('.resizer').forEach(function(ele) {
    resizable(ele, function(state) {
      if ("start"===state) {
        $$('.editors > *, #details-markdown',el=>{el.style.width=0;el.style.visibility='hidden';});
      }
      else {
        $$('.editors > *, #details-markdown',el=>{el.style.visibility='';});
        resize_editors();
      }
    });
  });

  // Detect changes to markdown to populate renderer
  let md = document.getElementById('game-documentation-view');
  on_editor_change('game-documentation', (value)=>{
    md.innerHTML = markdownConverter.makeHtml(value);
  });
  md.innerHTML = markdownConverter.makeHtml(editors['game-documentation'].getValue());

  // Populate reference panels with rendered markdown
  fetch('../docs/howto_game.md').then(r=>r.text()).then(md=>{document.getElementById('docs-howto-game').innerHTML = markdownConverter.makeHtml(md)});
  fetch('../docs/game_api.md').then(r=>r.text()).then(md=>{document.getElementById('docs-game-api').innerHTML = markdownConverter.makeHtml(md)});
  fetch('../docs/player_api.md').then(r=>r.text()).then(md=>{document.getElementById('docs-player-api').innerHTML = markdownConverter.makeHtml(md)});
  fetch('../docs/renderer_api.md').then(r=>r.text()).then(md=>{document.getElementById('docs-renderer-api').innerHTML = markdownConverter.makeHtml(md)});

  // Capture edits that should trigger updates immediately
  on_editor_change('game-code',setMatchConfig);
  on_editor_change('game-player-editor',setMatchConfig);

  on_editor_change('renderer-code',update_canvas);
  on_editor_change('renderer-html',update_canvas);
  on_editor_change('renderer-css',update_canvas);

  // Capture edits to player editor an update model
  on_editor_change('game-player-editor',value=>{
    $vm.game.players[$vm.selectedTestPlayer].code=value;
  },100);

  hide_overlay();
  setMatchConfig();
}

// Do the initial setup of the canvas to display our game

function update_canvas() {
  if (!$vm || !$vm.settings.run_on_change) { return; }
  matchRunner.update({
    html: editors['renderer-html'].getValue(),
    css: editors['renderer-css'].getValue(),
    js: editors['renderer-code'].getValue()
  });
}

function setMatchConfig() {
  if (!$vm) { return; }
  try {
    matchRunner.setGameCode(get_editor_value('game-code'));
    matchRunner.setDelay($vm.settings.delay);
    matchRunner.setPlayers([$vm.game.players[0].code, ($vm.game.players[1] ? $vm.game.players[1].code : $vm.game.players[0].code)]);
    if ($vm.settings.run_on_change) {
      matchRunner.start();
    }
  } catch (e) {
    // If it fails for some reason we really don't care
    console.log(e);
  }
}

// Receive messages from the display iframe
addEventListener('message', function(msg) {
  // if (!/vscode/.test(JSON.stringify(msg.data))) {
  //   console.log(`message received in main.js`, msg.data);
  // }
  let data = msg.data;
  if (data && data.error) {
    MessageError(data.error);
  }
});

async function save_game() {
  try {
    overlay("Saving...");
    let game = Object.assign({}, $vm.game);
    let mode = (game.id ? "update" : "create");

    let json = await API.saveGame(game);
    if (json.error) {
      MessageError("ERROR! "+json.error);
    }
    else {
      if ("update"===mode) {
        Message("Updated");
      }
      else {
        Message("Created");
        location.hash = "#"+json.id;
      }
      $vm.game = json;

      // Reset the dirty flag
      $vm.dirty = false;
      $vm.originalStringifiedGame = JSON.stringify(json);
    }
  }
  catch (e) {
    MessageError(e.toString());
  }
  hide_overlay();
}

async function publish() {
  try {
    let id = $vm.game.id;
    if (!id) {
      return MessageError("Cannot publish game until it is saved");
    }
    overlay("Publishing...");

    let json = await API.publishGame(id);
    if (json && json.error) {
      MessageError("ERROR! "+ JSON.stringify(json.error));
    }
    else {
      $vm.game = json;
      Message("Published");
    }
  }
  catch (e) {
    MessageError("Error in Publishing: "+e.toString());
  }
  hide_overlay();
}

// Capture key presses

document.addEventListener('keydown', function(event) {
  let S = 83;
  if ((event.key === S || event.keyCode === S) && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    save_game();
  }
});
