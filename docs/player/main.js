// Pre-define data attributes so Vue can detect changes
let data = {
  game: {},
  player: {},
  my_players: [],
  tests_passed: true,
  test_results: [],
  testSelected:null,
  view: 'player-code',
  popout: false,
  test_game_state: "{\n\n}",
  test_player_state: "{\n\n}",
  test_state_output: "",
  test_player_number: 0,
  test_opponent: "self",
  originalStringifiedPlayer: null,
  dirty:false,
  settings: {
    run_on_change: true,
    delay:0
  }
};

createVueApp(data,{
  methods: {
    file: name=>{
      $vm.view=name;
      resize_editors();
    },
    when: views=> {
      if (!$vm) {
        return false;
      }
      return views.includes($vm.view);
    },
    not_when: views=>{
      if (!$vm) {
        return false;
      }
      return !views.includes($vm.view);
    },
    copyState: async()=>{
      let state = await matchRunner.getState();
      set_editor_value('test_game_state',state);
    },
    addTest: ()=>{
      // console.log($vm.player.tests);
      if (!$vm.player.tests) {
        $vm.player.tests = [];
      }
      if ($vm.player && $vm.player.tests) {
        $vm.player.tests.push({
          name:"New Test",
          state:"{}",
          expect:""
        });
        $vm.testSelected = $vm.player.tests.length-1;
      }
    },
    selectTest: (index)=>{
      $vm.testSelected = index;
    },
    deleteTest: ()=>{
      $vm.player.tests.splice($vm.testSelected,1);
      $vm.testSelected = 0;
    },
    runTests: ()=>{
      run_tests();
    }
  },
  computed: {
    saved_ago() {
      return ago(this.player.updated_on, this.now);
    }
  },
  watch: {
    player: {
      handler(newValue, oldValue) {
        if (this.originalStringifiedPlayer==null) {
          this.originalStringifiedPlayer = JSON.stringify(newValue);
        }
        else {
          this.dirty = (JSON.stringify(newValue)!=this.originalStringifiedPlayer)
        }
      },
      deep:true
    },
    test_player_number: {
      handler(newValue, oldValue) {
        play_match();
      }
    },
    test_opponent: {
      handler(newValue,oldValue) {
        console.log(newValue);
        play_match();
      }
    }
  }
}).then(init);

let matchRunner = null;

async function init() {
  overlay("Loading...");

  // Attach resizers
  document.querySelectorAll('.resizer').forEach(function(ele) {
    resizable(ele, function(state) {
      if ("start"===state) {
        $$('.editors > *',el=>{el.style.width=0;el.style.visibility='hidden';});
      }
      else {
        $$('.editors > *',el=>{el.style.visibility='';});
        resize_editors();
      }
    });
  });

  // Retrieve the Game details
  let game_id = params.get('game');
  if (!game_id) {
    return overlay("No Game Specified");
  }
  let game = await API.getPublishedGame(game_id);
  if (game == null) {
    return overlay(`Game ${game_id} Not Found`);
  }
  $vm.game = game;

  let player_id = location.hash.substring(1);
  if (player_id) {
    await API.auth();
    if (!await API.getUser()) {
      login_overlay("to edit a player");
      API.onLogin(()=>{
        location.reload(true);
      });
      return;
    }
    let player = null;
    try {
      player = await API.getPlayer(player_id);
    } catch(e) {
      return alert(e);
    }
    $vm.player = player;
  }
  else {
    // Build a template player from the game info
    $vm.player = {
      code: $vm.game.player_template,
      name: $vm.game.name + " Player",
      tests: ($vm.game.tests || []),
      version: '1.0'
    }
  }

  // Load the user's other players for this game
  API.myPlayers().then(res=>{
    $vm.my_players =  (res.players||[]).filter(p=>p.game_id==game_id);
  });

  await init_monaco();

  // Populate reference panels with rendered markdown
  fetch('/docs/player_api.md').then(r=>r.text()).then(md=>{document.getElementById('docs-player-api').innerHTML = markdownConverter.makeHtml(md)});
  document.getElementById('docs-game-api').innerHTML = markdownConverter.makeHtml($vm.game.documentation);

  // Capture edits that should trigger updates immediately
  on_editor_change('player-code',function(code) {
    // Put the code back into the model
    //$vm.player.code = code;

    // Do a quick eval to make sure there are no syntax errors
    try {
      eval(`let module={exports:null};${code};`);
    } catch(e) {
      return MessageError(e);
    }
    play_match();
    run_tests();
  });

  // Configure the matchRunner display area
  matchRunner = MatchRunner.create({
    mount:'#match-runner-view'
  });
  matchRunner.setGame(game);

  // Listen for the match runner being popped into a window
  matchRunner.onpopout =function() {
    $vm.popout = true;
  };
  // Listen for match runner window being closed
  matchRunner.onpopin =function() {
    $vm.popout = false;
  };

  play_match();
  hide_overlay();
  resize_editors();
  run_tests();
}

function play_match() {
  if (!$vm || !$vm.loaded) { return; }
  try {
    // Setting the player list depends on user options
    let opponent_code;
    if ($vm.test_opponent=="self") {
      opponent_code = get_editor_value('player-code');
    }
    else {
      opponent_code = $vm.test_opponent;
    }
    let dev_code = get_editor_value('player-code');
    if ($vm.test_player_number==0) {
      matchRunner.setPlayers([dev_code, opponent_code]);
    }
    else {
      matchRunner.setPlayers([opponent_code, dev_code]);
    }
    matchRunner.setDelay($vm.settings.delay);
    matchRunner.start();
  } catch (e) {
    console.log(e);
    // If it fails for some reason we really don't care
  }
}

async function run_tests() {
  let err = function(e) {
    MessageError(e.message || e.toString());
  };
  let moved = false;
  let tests = $vm.player.tests;
  if (!tests) { return; }
  try {
    let player_code = get_editor_value('player-code');
    let test_state_player = getWorkerPlayerFromCode(player_code);
    $vm.test_results = [];
    $vm.tests_passed = null;

    for (let i=0; i<tests.length; i++) {
      let test = tests[i];
      let state = JSON.parse(test.state);
      let timer = setTimeout(function() {
        if (!moved) {
          test_state_player.terminate();
          test_state_player = getWorkerPlayerFromCode(player_code);
          err("Player moved timed out during test");
        }
      },1000);
      let move;
      try {
        move = await test_state_player.onTurn({
          gameState: state,
          playerState: null
        });
      }
      catch (e) {
        clearTimeout(timer);
        $vm.test_results.push({
          passed:false,
          output:"Error: "+e.message
        });
        $vm.tests_passed = false;
        continue;
      }
      clearTimeout(timer);
      moved = true;

      // Record results
      let move_json = move;
      if (typeof move=="object") {
        move_json = JSON.stringify(move);
      }

      // We have to play around with the "expected" value because it's always a string
      let expect = null;
      // Might be json syntax
      try {
        expect = JSON.stringify(JSON.parse(test.expect));
      } catch(e) {}
      // Might be a number
      if (expect==null) {
        expect = +test.expect;
        if (isNaN(expect)) {
          expect = null;
        }
      }
      // Otherwise it's a string
      if (expect==null) {
        expect = test.expect;
      }

      let passed = move_json === expect;
      $vm.test_results.push({
        passed:passed,
        output:JSON.stringify(move)
      });
      if (!passed) {
        $vm.tests_passed = false;
      }
    }

    // All tests done
    if ($vm.tests_passed==null) {
      $vm.tests_passed = true;
    }
    $vm.testSelected = null;

  } catch(e) {
    moved = true;
    set_editor_value('test_state_output', "");
    err("Error in Player: "+e.message);
  }
}

async function save() {
  $vm.player.game_id = $vm.game.id;

  try {
    overlay("Saving...");
    let player = Object.assign({}, $vm.player);
    let mode = (player.id ? "update" : "create");

    let json = await API.savePlayer(player);
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

      $vm.player = json;

      // Reset the dirty flag
      $vm.dirty = false;
      $vm.originalStringifiedPlayer = JSON.stringify(json);
    }
  }
  catch (e) {
    MessageError(e.toString());
  }
  hide_overlay();
}

async function publish() {
  try {
    let id = $vm.player.id;
    if (!id) {
      MessageError("Cannot publish player until it is saved");
    }
    overlay("Publishing...");

    let json = await API.publishPlayer(id);
    if (json && json.error) {
      MessageError("ERROR! "+ JSON.stringify(json.error));
    }
    else {
      Message("Published");
    }
  }
  catch (e) {
    MessageError(e.toString());
  }
  hide_overlay();
}
