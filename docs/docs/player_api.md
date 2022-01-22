# Player API

A Player is a javascript module that exports an Object that satisfies the Player API.

## Key Concepts

* Players are **stateless**. Your Player cannot keep variables between turns. Instead, you (optionally) store your state in an Object that is passed back to you on every turn in a game.
* Players are **self-contained**. They may not be async, access external resources, import modules, or make any async calls.
* Players can accumulate **knowledge** across games. If your Player is in a 5-game match, you can (optionally) pass an Object from one game to the next. For example, if your player has two different strategies and loses the first game, you can pass that knowledge to the next game so it uses a different strategy. Knowledge is **not** persisted across matches.
* Players only know how to play **one game**. The data structures describing Game state and Move format are defined entirely by the Game and can look very different between games. Players are written specifically for a single game.
* **Resources are limited**. Max execution time of Player methods is 1 second, and other limits may apply. Your code should not execute deep searches for best possible moves or it may time out and lose.
* Players are finite **algorithms**, not machine learning. Your code cannot change itself over time or learn because it is stateless.
* Any errors will cause your player to **lose** imediately. If your player has syntax errors, or does not implement methods correctly, or times out, it will immediately lose the game.

## Player Method API

```
interface Player {
  onGameStart(PlayerGameStart): PlayerState,
  onTurn(PlayerTurnRequest): PlayerTurn | Move,
  onGameEnd(PlayerGameEnd): PlayerKnowledge?
}
```

#### onGameStart

An **optional** method called before a Game starts, to inform the Player about initial game conditions, if any. It contains the Game State passed from the Game, as well as any player-defined Knowledge passed from the previous game in the match, if there was any.

Returns a player-define state to start the game with which will be passed to the first move.

Most players will not need to implement this method. 

#### onTurn

**Required Method!** Called each time it is your player's turn. This is where your logic lives.

This method is passed an Object containing both the Game state and your Player state (if you have set one in a previous call). Using only this information, your player determines which move to make.

You can return just your player's move, or optionally an object containing both your move and your PlayerState that will be passed back to you on next turn.

The structure of PlayerState is not defined and can be any data you wish to persist between turns.

The structure of your Move is defined by the Game.

#### onGameEnd

Called when a game is over. You are passed the final results of the game, the final game state, and your player state.

With this information, you may decide to derive some knowledge about how the game went and maybe tell yourself in the next game not to make a certain type of move. If so, then this method would return a PlayerKnowledge object which will be passed to your player's onGameStart method in the next game.

Most players will not need to implement this method.

## Player JSON API

The data structures expected by and returned by the above methods are defined as follows.

#### PlayerGameStart

Passed to the player when a game is ready to start. 

````
interface PlayerGameStart {
  gameState: GameState,
  knowledge?: PlayerKnowledge
}
````

#### PlayerTurnRequest

Passed to the Player when they are asked to take a turn.

````
interface PlayerTurnRequest {
  gameState: GameState,
  playerState: PlayerState
}
````

#### PlayerTurn

Passed from the Player to take a turn. The playerState attribute is optional if the player wishes to persist state between turns.

````
interface PlayerTurn {
  move: Move,
  playerState?: PlayerState
}
````

#### PlayerGameEnd

Passed to the Player when the game is over to inform of the results.

````
interface PlayerGameEnd {
  results: GameResults,
  gameState: GameState,
  playerState: PlayerState
}
````

### Opaque Types

These are player-defined data structures. Knowledge is passed from the player to itself between games so it can change its behavior over multiple games. PlayerState is within a single game only, passed to each turn and optionally updated.

```
type PlayerKnowledge;
type PlayerState;
```

