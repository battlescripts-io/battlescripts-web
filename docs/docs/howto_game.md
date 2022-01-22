# HOWTO Create a Game

A complete game consists of at least the following parts:

1. Game logic (javascript)
2. A visual Renderer (javascript + html + css)
3. Documentation (markdown)
4. Test players (javascript)
5. Player template (javascript)
6. metadata

### Definitions

**GameState**: The JSON data structure which represents the state of your game. This is defined entirely by you and is different for every game. It may contain a board layout, information about cards or items that players have, metadata about moves remaining, or anything else needed.

**PlayerState**: While the GameState holds global state that your code uses to manage the game, the state of the game handed to each player on their turn might be different. For example, the PlayerState might contain their location on a board, but not the location of opponents. When you ask a Player to move, you pass them PlayerState. Your Game code must create that state each time, if it is different than your GameState. In many cases, PlayerState == GameState.

**Move**: Players of your game will return a Move back to you. This again is a JSON data structure defined entirely by you. It can be a single number, an Array, a complex JSON object, or anything else you define. You must document the move format that your players are expected to return to you.

**Scores**: Since BattleScripts is an abstract game engine, a Game might not have just a single winner and loser. Instead, at the end of each game players are given numeric scores. Your Game decides how to allocate points, but the player with the highest points will be considered the winner. So, for example, for a simple 2-player game you might award the winner 1 point and the loser 0 points. If it's a draw, you might award each of them 0.5 points. Points may matter in a match of many games, where the overall winner might not be determined by total wins and losses, but by total points accumuated over *n* games.

**Scenario**: This is like a variation of options for your game, and is entirely optional. Most games will not implement Scenarios. A Scenario is a data structure defined by you which defines starting conditions for your game. For example, a size of board, or toggling game options on or off, or selecting how many pieces a player starts with. Your game may be passed a scenario when it is created, if you have defined scenarios in your game configuration and one is selected when the match is started.

**Renderer**: The code, html, and css that will be used to draw your game on the screen, when passed the GameState. Every game must define a way to render itself.

### How to get started

There are a lot of moving parts to a Game and you can develop them in any way you wish. If you are new to creating Games, we would recommend this process:

1. **Define your GameState.** Think thoroughly about every piece of data you will need to store to represent the state of your game. Think about the easiest way to access the data you need to update when players take their turns. Think about whether you need to scrub the GameState before passing it to Players for their turn, and how easy that may or may not be. Think about what information is public to all players, and what should only be known to individual Players.

   Edit your Game's index.js file to create your initial GameState so it will be passed to the Renderer when a game starts. Your default Players will error out, but your game will generate an initial GameState.
   
2. **Build a simple Renderer.** Write your render() function in index.js or create a Vue template in index.html that can represent your game visually, even if it is just plain text. This will help validate your GameState design. Does it really have everything you need to build a visual representation of your Game? Edit the State manually in the State panel to test the state structure.

3. **Write simple game logic.** Think about how you will determine whose turn it is, how you will represent player moves on your board, and how players will know who they are on the board when it's their turn. Don't worry about validating moves or updating the board yet.

4. **Write a simple "random" test player.** Don't think about strategy. Just make the simplest valid moves possible. Or just hard-code a single move. This will help you start writing your game logic.

5. **Test your Game.** Add game logic to update your GameState with player moves, add very simple move validation, and write simple code to test if someone has won. Does it play? Can players actually move? Does it get stuck anywhere? Are valid GameDirectives being returned? Use the State preview to see what the state of the game is at render time. Is your game being rendered correctly? Does your game know how to correctly determine if the game is over?
 
6. **Make game logic robust.** Adding robust error-checking for player moves, with helpful error messages if moves are invalid. Optimize your algorithm to determine if the game is over. Maybe abstract the creation of your GameDirective. 

7. **Make smarter players.** Try adding some real logic. Is the State being passed to players enough to make intelligent moves? Should you provide any other data structures to help Players be created more easily? Does your game handle all possible ways for the game to end, with smarter players?

8. **Make it fancy.** Add more html and css to your Renderer to make the game look nicer. Do you need to add more to your State to help the Renderer? For example, flagging winning moves so they can be highlighted by the Renderer at the end of the game. Your Renderer shouldn't have game logic to determine winning moves or things to highlight. Your game logic should do all that and represent it in the State.

9. **Create a player template.** This will be the starting point for a user creating a player for your game. Do you want to create helper methods? Comments to help get a user started? Or nothing at all?

10. **Upload images.** Create logos and banners for your game and upload them so your game looks great on the site.

11. **Write documentation.** Describe your game and how it works. Define the PlayerState that players will receive when it's their turn, and what a valid Move looks like. Be clear about what will happen if a player makes an invalid move, for example. Do they instantly lose? Or their move is ignored?

12. **Submit!** Once your game is done, Submit it to be Published and listed on the site. All games must be manually approved before being published.

### Game Flow

![](/docs/flow.png)
