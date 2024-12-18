

//import { Chess } from 'chess.js'
//import { Chessboard2 } from '../node_modules/@chrisoakman/chessboard2/dist/chessboard2.min'
// This example uses the chess.js library:
// https://github.com/jhlywa/chess.js

// NOTE: the game object is separate from the board object
// the game object:
// - controls the state of the game
// - understands how pieces move and what moves are legal
// - knows who's turn it is
// - en passant, castling, draw logic, etc
const game = new Chess()
const chessAI = new ChessAI(game);
// the board object is "dumb":
// - shows the current position from the game
// - handles input events from users
const boardConfig = {
  draggable: true,
  onDragStart,
  onTouchSquare,
  onDrop,
  onSnapEnd,
  position: game.fen(),
  touchMove: true
}
const board = Chessboard2('myBoard', boardConfig)

updateStatus()

let pendingMove = null

let gameNotAllowedMoves = [];

// There are 5 outcomes from this action:
// - start a pending move
// - clear a pending move
// - clear a pending move AND start a different pending move
// - make a move (ie: complete their pending move)
// - do nothing
function onTouchSquare(square, piece, boardInfo) {
  // ask chess.js what legal moves are available from this square
  const legalMoves = game.moves({ square, verbose: true })

  // Option 1: start a pending move
  if (!pendingMove && legalMoves.length > 0) {
    pendingMove = square

    // add circles showing where the legal moves are for this piece
    legalMoves.forEach(move => {
      board.addCircle(move.to)
    })

    // Option 2: clear a pending move if the user selects the same square twice
  } else if (pendingMove && pendingMove === square) {
    pendingMove = null
    board.clearCircles()

    // Option 3: clear a pending move and start a new pending move
  } else if (pendingMove) {
    // ask chess.js to make a move
    const moveResult = game.move({
      from: pendingMove,
      to: square,
      promotion: 'q' // always promote to a Queen for example simplicity
    })

    // was this a legal move?
    if (moveResult) {
      // clear circles on the board
      board.clearCircles()

      // update to the new position
      board.position(game.fen()).then(() => {
        updatePGN()
        updateStatus()

        // wait a smidge, then make a random move for Black
        window.setTimeout(makeSmartMove, 250)
      })

      // if the move was not legal, then start a new pendingMove from this square
    } else if (piece) {
      pendingMove = square

      // remove any previous circles
      board.clearCircles()

      // add circles showing where the legal moves are for this piece
      legalMoves.forEach(m => {
        board.addCircle(m.to)
      })

      // else clear pendingMove
    } else {
      pendingMove = null
      board.clearCircles()
    }
  }
}

function updateStatus() {
  let statusHTML = ''
  const whosTurn = game.turn() === 'w' ? 'White' : 'Black'

  if (!game.game_over()) {
    if (game.in_check()) statusHTML = whosTurn + ' is in check! '
    statusHTML = statusHTML + whosTurn + ' to move.'
  } else if (game.in_checkmate() && game.turn() === 'w') {
    statusHTML = 'Game over: white is in checkmate. Black wins!'
  } else if (game.in_checkmate() && game.turn() === 'b') {
    statusHTML = 'Game over: black is in checkmate. White wins!'
  } else if (game.in_stalemate() && game.turn() === 'w') {
    statusHTML = 'Game is drawn. White is stalemated.'
  } else if (game.in_stalemate() && game.turn() === 'b') {
    statusHTML = 'Game is drawn. Black is stalemated.'
  } else if (game.in_threefold_repetition()) {
    statusHTML = 'Game is drawn by threefold repetition rule.'
  } else if (game.insufficient_material()) {
    statusHTML = 'Game is drawn by insufficient material.'
  } else if (game.in_draw()) {
    statusHTML = 'Game is drawn by fifty-move rule.'
  }

  document.getElementById('gameStatus').innerHTML = statusHTML
}

function updatePGN() {
  const pgnEl = document.getElementById('gamePGN')
  pgnEl.innerHTML = game.pgn({ max_width: 5, newline_char: '<br />' })
}

function onDragStart(dragStartEvt) {
  // do not pick up pieces if the game is over
  if (game.game_over()) return false

  // only pick up pieces for White
  if (!isWhitePiece(dragStartEvt.piece)) return false

  // what moves are available to White from this square?
  const legalMoves = game.moves({
    square: dragStartEvt.square,
    verbose: true
  })

  // do nothing if there are no legal moves
  if (legalMoves.length === 0) return false

  // place Circles on the possible target squares
  legalMoves.forEach((move) => {
    board.addCircle(move.to)
  })
}

function isWhitePiece(piece) { return /^w/.test(piece) }

function makeSmartMove() {
  const move = chessAI.makeBestMove('b')
  game.move(move)
  board.position(game.fen(), (_positionInfo) => {
    updateStatus()
    updatePGN()
  })
}
function makeRandomMove() {
  const possibleMoves = game.moves()

  // game over
  if (possibleMoves.length === 0) return

  const randomIdx = Math.floor(Math.random() * possibleMoves.length)
  game.move(possibleMoves[randomIdx]);
  board.position(game.fen(), (_positionInfo) => {
    updateStatus()
    updatePGN()
  })
}

function onDrop(dropEvt) {
  //block Not allowed moves
  if (gameNotAllowedMoves.length > 0) {
    let move = dropEvt.source + ' ' + dropEvt.target;
    //check if the move is not in the list of not allowed moves
    const isNotAllowedMove = gameNotAllowedMoves.find(m => m.from === dropEvt.source && m.to === dropEvt.target);
    if (isNotAllowedMove) {
      return 'snapback';
    }
  }

  // see if the move is legal
  const move = game.move({
    from: dropEvt.source,
    to: dropEvt.target,
    promotion: 'q' // NOTE: always promote to a queen for example simplicity
  })

  // remove all Circles from the board
  board.clearCircles();
  // clear Not allowed moves
  gameNotAllowedMoves = [];

  // the move was legal
  if (move) {
    // reset the pending move
    pendingMove = null

    // update the board position
    board.fen(game.fen(), () => {
      updateStatus()
      updatePGN()

      // make a random legal move for black
      window.setTimeout(makeSmartMove, 250);
      clearArrows();
    })
  } else {
    // reset the pending move
    pendingMove = null

    // return the piece to the source square if the move was illegal
    return 'snapback'
  }
}

// update the board position after the piece snap
// for castling, en passant, pawn promotion
function onSnapEnd() {
  board.position(game.fen())

}

function showArrows() {
  //const moves = game.moves({verbose: true});

  board.addArrow({
    start: 'b2',
    end: 'b4'
  })
  board.addArrow({
    start: 'b2',
    end: 'd4'
  })
}
function clearArrows() {
  board.clearArrows()
}
function loadBranch(pgn, usedMoves) {
 



  game.load_pgn(pgn);
  board.position(game.fen());
  updateStatus();
  updatePGN();


  const moves = findMovesForPositions(pgn);
  gameNotAllowedMoves = moves;

  //show arrows for used moves
  board.clearArrows();
  gameNotAllowedMoves.forEach(move => {
    board.addArrow({
      start: move.from,
      end: move.to
    }, 'small')
  });
}
function saveBranch() {

}
function findMovesForPositions(currentPgn) {
  const pgns = readRawPGN();
  const nextMoves = [];
  if (!currentPgn) currentPgn = '';

  const chessCore = new Chess();
  chessCore.load_pgn(currentPgn);
  const moveHistory = chessCore.history({ verbose: true });
  const moveCount = moveHistory.length;

  for (let i = 0; i < pgns.length; i++) {
    //find all pgn starting with the same moves
    if (pgns[i].startsWith(currentPgn)) {

      const chess = new Chess()
      chess.load_pgn(pgns[i]);
      const moveHistory = chess.history({ verbose: true });
      const nextMove = moveHistory[moveCount];


      //todo: check if the move is not in the used moves
      nextMoves.push(nextMove);


    }
  }
  console.log("nextMove", nextMoves);
  return nextMoves;
}
function readRawPGN() {
 //chess.load_pgn(pgn.join('\n'));
  const cleanedDataSets = pngRawData.map(dataSet =>
    dataSet
      .replace(/\[[^\]]*\]\n?/g, '')  // Remove items in square brackets and the following newline
      .replace(/\r?\n/g, ' ')         // Replace all return lines with spaces
      //remove white space before the string
      .replace(/^\s+/, '')


  );
  return cleanedDataSets;
}
function createBranch(){

}