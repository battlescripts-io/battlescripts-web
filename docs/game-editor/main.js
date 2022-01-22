// Pre-define data attributes so Vue can detect changes
let data = {
  loaded: false,
  view: "docs-howto-game",
  popout: false,
  game: {},
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
    file: name => {
      $vm.view = name;
      resize_editors();
    },
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
  on_editor_change('p1',setMatchConfig);
  on_editor_change('p2',setMatchConfig);

  on_editor_change('renderer-code',update_canvas);
  on_editor_change('renderer-html',update_canvas);
  on_editor_change('renderer-css',update_canvas);

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
    matchRunner.setPlayers([get_editor_value('p1'),get_editor_value('p2')]);
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
  // // Get the editor contents out and back into the game object
  // $vm.game.code = editors['game-code'].getValue();
  // $vm.game.documentation = editors['game-documentation'].getValue();
  // $vm.game.player_template = editors['game-player-template'].getValue();
  // $vm.game.renderer_code = editors['renderer-code'].getValue();
  // $vm.game.renderer_html = editors['renderer-html'].getValue();
  // $vm.game.renderer_css = editors['renderer-css'].getValue();
  //
  // // Hard-coding 2 test players for now. will be modular later.
  // $vm.game.test_players = [
  //   editors['p1'].getValue(),
  //   editors['p2'].getValue()
  //   ];

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
