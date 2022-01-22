(async function() {
  let data = {
    games: [],
    game: null,
    leaderboard:null,
    popout: false,
    match_data: {}
  };
  let leaderboard_data_url = API.getDataPath() + "/leaderboard";
  let matchRunner = MatchRunner.createViewer();
  matchRunner.onpopout = ()=>{
    $vm.popout=true;
  };
  matchRunner.onpopin = ()=>{
    $vm.popout=false;
  };

  await createVueApp(data, {
    methods: {
      toggle: async(row,game_id,player_id)=>{
        if (!row.matches) {
          row.matches = await fetchJson(`${leaderboard_data_url}/game-${game_id}-player-${player_id}.json`);
          row.expanded = true;
        }
        else {
          row.expanded = !row.expanded;
        }
      },
      view: async(match_row, match_id)=>{
        let match =await fetchJson(`${leaderboard_data_url}/match-${match_id}.json`);
        matchRunner.setMatch(match);
      }
    }
  },null,init);

  async function init() {
    let game_id = location.search.replace(/^\?/,'');
    if (game_id) {
      $vm.game = await fetchJson(`${leaderboard_data_url}/game-${game_id}.json`);
      // Get the game code itself for the match runner
      let game = await API.getPublishedGame(game_id);
      matchRunner.setGame(game);
    }
    $vm.games = await fetchJson(`${leaderboard_data_url}/index.json`);
    $vm.leaderboard = await fetchJson(`${leaderboard_data_url}/leaderboard.json`);
    matchRunner.mount('#viewer');
  }

})();
