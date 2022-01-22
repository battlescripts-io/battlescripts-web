# Game API

The API contract that a Game must fulfill consists of two pieces:

1. JSON messages which must be sent and received from the Game Engine
2. Methods that must be implemented to send and receive those messages

## JSON Messages

#### GameDirective

The Game returns this as the "command" to the Engine to control flow. This is the core of the Game's interaction with the Engine.

```
interface GameDirective {
  // Game returns state with every Directive.
  // It can be optionally rendered now or later.
  state: GameState,

  // Request that one or more players take a turn.
  // Pass each player a game state that is specific to them.
  getTurn?: {
    PlayerId: PlayerState
  },

  // Return true if the game is over and the loop should terminate  
  gameOver?: Boolean,
  
  // If gameOver==true, then results must be returned.
  results?: {
    // Each player will get a numeric score with a game-defined max.
    // The highest score(s) is the winner(s)
    // The Game decides how many points to award.
    PlayerId: Number
  },
  
  // Info from the game, which might be displayed to the user in a UI.
  log?: String | [ String* ]
}
```

##### Example GameDirectives

This directive is asking Player 0 to take a turn. Notice how the state that Player 0 receives for their turn is different than the GameState held internally. In this made-up example, each player gets to know ther own pieces, but never sees the other player's pieces. But the GameState itself holds everything so each player's pieces can be rendered visually while watching the game.

Also notice how the PlayerState tells the player which player they are. This is so the player logic can inspect the board and know which pieces are theirs vs their opponent. Otherwise, players wouldn't know who they are since they may be Player 0 or Player 1 in a game.

```
{
  state: {
    board: [null,null,0,1,1,1,0,0,1,null,null],
    pieces: {
      0: ["A","B","C"],
      1: ["X","Y","Z"]
    },
    player: 0
  },
  getTurn {
    0: {
      board: [null,null,0,1,1,1,0,0,1,null,null],
      pieces: ["A","B","C"],
      player: 0
    }
  }
}
```

This is an example of a GameDirective returns from a Game once it realizes the game is over. In this example, the GameState has an extra "winning_move" attribute. This is so the Renderer can highlight the last move as the winning move to show what won the game.

```
{
  gameOver: true,
  state: {
    board: [null,null,0,1,1,1,0,0,1,null,null],
    winning_move: 5,
  },
  results: {
    0: 1,
    1: 0
  }
}
```

#### PlayerTurns

After requesting moves from players, the Engine passes this message to the Game to process the moves. If your game is a simple 2-player game, this Object will contain just a single Player's move. In more complex multi-player games, multiple players may move at the same time.

```
interface PlayerTurns {
  PlayerId: PlayerTurn
}
```

##### Example PlayerTurns

Player 0 moves to position [5,4] on your board.

```
{
  0: [5,4]
}
```

#### Opaque Types

Just to be clear: These are game-defined types that may contain **any** data or structure as decided and documented by the Game being played.

```
type GameState;
type Move;
type Scenario;
````

## Game Method API

The code for a Game is a module that exports an Object exposing 3 methods.

#### create(Scenario): GameState

When a match is started, the Game is passed the scenario to be played. Usually this will be empty.

The create() methods returns a GameState object that will then be passed to each Player's onGameStart() method to inform them that the game is beginning. This will allow them to intiialize their player for a specific set of options or board size, for example.

In most cases, create() will just return {}.

#### start(): GameDirective

When all Players are ready, your game will be called to start().

This is when play begins, and your game should respond with a GameDirective asking for a player to take a turn.

#### onTurn(PlayerTurns): GameDirective

Procss player moves, update your state, decide if the game is over, and return a new GameDirective. The GameDirective will either inform the Engine that the game is over and what the results are, or ask for another player move.
