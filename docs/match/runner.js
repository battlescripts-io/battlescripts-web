function createMatchController() {
  // State.
  let isGameOver, viewState, controller;
  let controllerId = 0;
  let game = null;
  let gameCode = null;
  let players = [];
  let playersCode = null;
  let games = 1;
  let delay = 0;
  let replayTimeout = null;

  return {
    // "start" also means "resume" here.
    // TODO: Seaparate into start and resume methods?
    start(restart=false) {
      if (!viewState || isGameOver || restart) {
        start();
      } else if (viewState) {
        controller.play();
      }
    },
    replay() {
      viewState.rewind();
      let step=function() {
        if (replayTimeout) {
          clearTimeout(replayTimeout);
        }
        updateViewStateDisplay(viewState.nextMove());
        if (viewState.currentIndex>0) {
          replayTimeout = setTimeout(step,300);
        }
      };
      step();
    },
    view(state,logs) {
      view(state);
      updateLogDisplay(logs||[]);
      controller.play();
    },
    abort() {
      controller.abort();
    },
    pause() {
      controller.pause();
    },
    previousMove() {
      updateViewStateDisplay(viewState.previousMove());
    },
    nextMove() {
      updateViewStateDisplay(viewState.nextMove());
    },
    gotoMove(index,updateSlider=true) {
      updateViewStateDisplay(viewState.gotoMove(index),updateSlider);
    },
    async step(restart=false) {
      if (!viewState || isGameOver || restart) {
        start();
      }
      controller.step();
    },

    setGame(g) {
      game = g;
      gameCode = null;
    },
    setNumberOfGames(n) {
      games = n;
    },
    setPlayers(p) {
      players = p;
      playersCode = null;
    },
    setDelay(n) {
      delay = n;
    },
    getState() {
      return get_editor_value('state', state);
    }
  };

  // View an existing game
  function view(stateSummary) {
    if (controller) {
      // console.log(`Aborting controller ${controller.id}`);
      controller.abort();
    }
    isGameOver = true;
    viewState = createViewState();
    let sliderStatus = viewState.setState(stateSummary);
    updateViewStateDisplay(sliderStatus);
    controller = createController();
  }

  // Run a test match
  function start() {
     //console.log("Starting a game");

    // If there was a previous game in progress, abort it
    if (controller) {
      // console.log(`Aborting controller ${controller.id}`);
      controller.abort();
    }

    isGameOver = false;
    viewState = createViewState();
    controller = createController();

    // console.log(`New controller id: ${controller.id}`);
    // Make sure we have all the pieces we need to run a game
    if (!game) {
      throw "Can't start a match because game hasn't been defined";
    }
    if (!players || players.length<2) {
      throw "Can't start a match because no players have been set";
    }

    let startConfig = {games:games};

    // Make sure we have runnable code.
    try {
      gameCode = getCode(game);
    } catch (e) {
      throw `Error in game code: ${e}`;
    }

    // Convert the players to Workers every time because they get terminated each game
    try {
      playersCode = [];
      players.forEach((p, i) => {
        playersCode[i] = getWorkerPlayerFromCode(players[i]);
      });
    } catch (e) {
      throw `Error in player code: ${e}`;
    }

    startConfig.game = gameCode;
    startConfig.players = playersCode;
    // Setup the battlescripts observer
    let lastMove = null;
    let log = [];
    updateLogDisplay(log);
    battlescripts.observe(async (gd)=>{
      // A GameDirective from the Game
      if (gd.state) {
        if (gd.log) {
          log = log.concat(gd.log);
          updateLogDisplay(log);
        }
        updateGameDirectiveDisplay(gd);
        if (gd.gameOver) {
          isGameOver = true;
          sendMessage({type:"matchrunner/gameover",data:gd.results});
        }

        // Check for errors and if they exist send them up to the parent
        if (gd.errors) {
          sendMessage({type:"matchrunner/error",data:gd.errors});
        }

        let viewSummary = viewState.addState(clone(gd.state), clone(gd), clone(lastMove));
        updateViewStateDisplay(viewSummary);

        // Return our own Promise so we can control the delay
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            let next = controller.next();
            if (next == null) {
              reject("aborted");
            }
            resolve(next);
          }, delay);
        });
      }
      // A Move from a Player
      else {
        lastMove = gd;
      }
    });

    try {
      startConfig.turnTimeout = 1000;
      battlescripts.match(startConfig).then((matchResults)=>{
        updateResultsDisplay(matchResults.results);
        startConfig.players.forEach((p)=>{
          p.terminate();
        });
      });
    } catch (e) {
      console.log(e);
      controller.abort();
      isGameOver = true;
      startConfig.players.forEach((p,i)=>{
        p.terminate();
      });
      throw e;
    }
  }

  function updateViewStateDisplay(info,updateSlider=true) {
    let i = $('#matchStateIndex');
    let t = $('#matchStateTotal');
    let c = $('#matchStateControl');
    if (i) {
      i.textContent = info.current;
    }
    if (t) {
      t.textContent = info.total;
    }
    if (c && updateSlider) {
      c.max = info.total - 1;
      c.value = info.current - 1;
    }
  }

  function updateGameDirectiveDisplay(gd) {
    set_editor_value('gamedirective', gd);
    if (gd.state) {
      set_editor_value('state',gd.state);
    }
  }

  function updateResultsDisplay(results) {
    set_editor_value('results', battlescripts.tally(results));
  }

  function updateLogDisplay(log) {
    set_editor_value('log', log.join("\n"));
  }

  function createViewState() {
    return {
      currentIndex: 0,
      stateHistory: [],
      directiveHistory: [],
      moveHistory: [],

      info() {
        return {
          current: this.stateHistory.length - this.currentIndex,
          total: this.stateHistory.length
        };
      },
      setState(stateHistory) {
        this.stateHistory = stateHistory;
        this.directiveHistory=[];
        this.moveHistory=[];
        this.currentIndex=0;
        this.updateView();
        return this.info();
      },
      addState(state, gd, lastMove) {
        this.stateHistory.unshift(state);
        this.directiveHistory.unshift(gd);
        this.moveHistory.unshift(lastMove);

        // Keep the view in the same place unless we are viewing the latest.
        if (this.currentIndex !== 0) {
          this.currentIndex = this.currentIndex + 1;
        }

        this.updateView();
        return this.info();
      },

      updateView() {
        let state = this.stateHistory[this.currentIndex];
        let gd = this.directiveHistory[this.currentIndex] || null;
        let lastMove = this.moveHistory[this.currentIndex] || null;

        if (state) {
          // Send the state to the renderer
          sendMessage({"state": state}, canvas);

          // Update the display fields
          set_editor_value('state', state);
          set_editor_value('gamedirective', gd);
          set_editor_value('lastmove', lastMove);
        }
      },

      previousMove() {
        this.currentIndex = Math.min(this.stateHistory.length - 1, this.currentIndex + 1);
        this.updateView();
        return this.info();
      },

      nextMove() {
        this.currentIndex = Math.max(0, this.currentIndex - 1);
        this.updateView();
        return this.info();
      },

      gotoMove(index) {
        this.currentIndex = this.stateHistory.length - 1 - index;
        this.updateView();
        return this.info();
      },

      rewind() {
        this.currentIndex = this.stateHistory.length - 1;
        this.updateView();
        return this.info();
      }
    };
  }

  // Controller as in an air traffic controller.
  function createController() {
    const states = { CLEAR: 'CLEAR', SUSPENDED: 'SUSPENDED', ABORT: 'ABORT' };

    return {
      id: controllerId++,
      _pendingRequest: null,
      _state: states.CLEAR,
      play() {
        this._state = states.CLEAR;
        this._clearPending();
      },
      abort() {
        // console.log(`abort() called in controller #${this.id}`);
        this._state = states.ABORT;
        if (this._pendingRequest) {
          console.log(`Rejecting pending promise in controller ${this.id}`);
          this._pendingRequest.promise.reject(states.ABORT);
        }
      },
      pause() {
        this._state = states.SUSPENDED;
      },
      step() {
        this.pause();

        if (this._pendingRequest) {
          this._pendingRequest.promise.then(() => {
            this.pause();
          });

          this._clearPending();
        }
      },
      next() {
        if (this._state === states.ABORT) {
          // console.log("in next() and state==ABORT");
          if (this._pendingRequest) {
            // console.log("Pending request exists, rejecting");
            this._pendingRequest.reject(states.ABORT);
          }
          // console.log("Returning null");
          return null;
        }
        if (this._state === states.CLEAR) {
          return Promise.resolve();
        }
        if (this._state === states.SUSPENDED) {
          this._ensurePending();
          return this._pendingRequest.promise;
        }
        return null;
      },
      _ensurePending() {
        if (!this._pendingRequest) {
          let promise = new Promise((fulfill, reject) => {
            this._pendingRequest = { fulfill, reject };
          });
          this._pendingRequest.promise = promise;
        }
      },
      _clearPending() {
        if (this._pendingRequest) {
          this._pendingRequest.fulfill();
        }

        this._pendingRequest = null;
      }
    };
  }
}
