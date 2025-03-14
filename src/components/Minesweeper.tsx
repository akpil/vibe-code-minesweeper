import { useState, useEffect, useCallback } from "react";
import { Flag, Bomb, RefreshCw, HelpCircle, ArrowUpDown, Clock, Calendar, Award } from "lucide-react";

// Cell types
type CellState = {
  isMine: boolean;
  isRevealed: boolean;
  marking: "none" | "flag" | "question"; // Three-state marking
  neighborMines: number;
  isNew?: boolean; // For animation
};

// Difficulty levels
type Difficulty = "beginner" | "intermediate" | "expert";

const difficultySettings = {
  beginner: { rows: 9, cols: 9, mines: 10 },
  intermediate: { rows: 16, cols: 16, mines: 40 },
  expert: { rows: 16, cols: 30, mines: 99 },
};

// Score type
type Score = {
  id: string;
  date: string;
  time: number; // in seconds with 2 decimal places
  difficulty: Difficulty;
};

// Sort direction
type SortDirection = "asc" | "desc";

// Sort field
type SortField = "date" | "time" | "difficulty";

const Minesweeper = () => {
  const [difficulty, setDifficulty] = useState<Difficulty>("beginner");
  const [board, setBoard] = useState<CellState[][]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [flagCount, setFlagCount] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [elapsedTimeMs, setElapsedTimeMs] = useState(0); // More precise time for scoreboard
  const [hoverCell, setHoverCell] = useState<{ row: number; col: number } | null>(null);
  const [affectedCells, setAffectedCells] = useState<{ row: number; col: number }[]>([]);
  const [insufficientFlagCells, setInsufficientFlagCells] = useState<{ row: number; col: number }[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Load scores from localStorage on component mount
  useEffect(() => {
    const savedScores = localStorage.getItem("minesweeperScores");
    if (savedScores) {
      setScores(JSON.parse(savedScores));
    }
  }, []);

  // Save scores to localStorage when scores change
  useEffect(() => {
    localStorage.setItem("minesweeperScores", JSON.stringify(scores));
  }, [scores]);

  // Initialize the game board
  const initializeBoard = useCallback(() => {
    const { rows, cols, mines } = difficultySettings[difficulty];
    
    // Create empty board
    const newBoard: CellState[][] = Array(rows)
      .fill(null)
      .map(() =>
        Array(cols).fill(null).map(() => ({
          isMine: false,
          isRevealed: false,
          marking: "none",
          neighborMines: 0,
        }))
      );
    
    // Place mines randomly
    let minesPlaced = 0;
    while (minesPlaced < mines) {
      const row = Math.floor(Math.random() * rows);
      const col = Math.floor(Math.random() * cols);
      
      if (!newBoard[row][col].isMine) {
        newBoard[row][col].isMine = true;
        minesPlaced++;
      }
    }
    
    // Calculate neighbor mines
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (!newBoard[row][col].isMine) {
          let count = 0;
          // Check all 8 surrounding cells
          for (let r = Math.max(0, row - 1); r <= Math.min(rows - 1, row + 1); r++) {
            for (let c = Math.max(0, col - 1); c <= Math.min(cols - 1, col + 1); c++) {
              if (newBoard[r][c].isMine) count++;
            }
          }
          newBoard[row][col].neighborMines = count;
        }
      }
    }
    
    setBoard(newBoard);
    setGameOver(false);
    setGameWon(false);
    setFlagCount(0);
    setStartTime(null);
    setElapsedTime(0);
    setElapsedTimeMs(0);
    setHoverCell(null);
    setAffectedCells([]);
    setInsufficientFlagCells([]);
  }, [difficulty]);

  // Initialize on component mount and difficulty change
  useEffect(() => {
    initializeBoard();
  }, [difficulty, initializeBoard]);

  // Timer logic with millisecond precision
  useEffect(() => {
    let interval: number | null = null;
    
    if (startTime && !gameOver && !gameWon) {
      interval = window.setInterval(() => {
        const now = Date.now();
        const elapsed = now - startTime;
        setElapsedTime(Math.floor(elapsed / 1000));
        setElapsedTimeMs(elapsed / 1000); // Store time in seconds with millisecond precision
      }, 100); // Update more frequently for better precision
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [startTime, gameOver, gameWon]);

  // Get adjacent cells
  const getAdjacentCells = (board: CellState[][], row: number, col: number) => {
    const rows = board.length;
    const cols = board[0].length;
    const adjacentCells: { row: number; col: number }[] = [];
    
    for (let r = Math.max(0, row - 1); r <= Math.min(rows - 1, row + 1); r++) {
      for (let c = Math.max(0, col - 1); c <= Math.min(cols - 1, col + 1); c++) {
        if (r !== row || c !== col) {
          adjacentCells.push({ row: r, col: c });
        }
      }
    }
    
    return adjacentCells;
  };

  // Calculate affected cells for chord click
  const calculateAffectedCells = (row: number, col: number) => {
    if (gameOver || gameWon || !board[row][col].isRevealed || board[row][col].neighborMines === 0) {
      return [];
    }
    
    const adjacentCells = getAdjacentCells(board, row, col);
    const adjacentFlags = adjacentCells.filter(
      ({ row: r, col: c }) => board[r][c].marking === "flag"
    ).length;
    
    // Only show affected cells if the number of flags matches the cell's number
    if (adjacentFlags === board[row][col].neighborMines) {
      return adjacentCells.filter(
        ({ row: r, col: c }) => !board[r][c].isRevealed && board[r][c].marking !== "flag"
      );
    }
    
    return [];
  };

  // Handle mouse enter on cell
  const handleMouseEnter = (row: number, col: number) => {
    setHoverCell({ row, col });
    
    if (board[row][col].isRevealed && board[row][col].neighborMines > 0) {
      setAffectedCells(calculateAffectedCells(row, col));
    } else {
      setAffectedCells([]);
    }
  };

  // Handle mouse leave
  const handleMouseLeave = () => {
    setHoverCell(null);
    setAffectedCells([]);
  };

  // Handle chord click (clicking on a revealed number)
  const handleChordClick = (row: number, col: number) => {
    if (gameOver || gameWon) return;
    
    const cell = board[row][col];
    
    // Only process if the cell is revealed and has a number
    if (!cell.isRevealed || cell.neighborMines === 0) return;
    
    // Start timer on first click if not started
    if (startTime === null) {
      setStartTime(Date.now());
    }
    
    const adjacentCells = getAdjacentCells(board, row, col);
    
    // Count adjacent flags
    const adjacentFlags = adjacentCells.filter(
      ({ row: r, col: c }) => board[r][c].marking === "flag"
    ).length;
    
    // If the number of adjacent flags matches the cell's number
    if (adjacentFlags === cell.neighborMines) {
      const newBoard = [...board];
      let hitMine = false;
      
      // Reveal all non-flagged adjacent cells
      for (const { row: r, col: c } of adjacentCells) {
        if (newBoard[r][c].marking !== "flag" && !newBoard[r][c].isRevealed) {
          // If we hit a mine, game over
          if (newBoard[r][c].isMine) {
            hitMine = true;
          } else {
            // Otherwise reveal the cell and its empty neighbors
            revealCellRecursive(newBoard, r, c);
          }
        }
      }
      
      // If we hit a mine, reveal all mines and end the game
      if (hitMine) {
        for (let r = 0; r < newBoard.length; r++) {
          for (let c = 0; c < newBoard[0].length; c++) {
            if (newBoard[r][c].isMine) {
              newBoard[r][c].isRevealed = true;
            }
          }
        }
        setBoard(newBoard);
        setGameOver(true);
        return;
      }
      
      setBoard(newBoard);
      
      // Check if game is won
      checkWinCondition(newBoard);
    } else if (adjacentFlags < cell.neighborMines) {
      // If there are not enough flags, highlight the adjacent cells
      const unrevealed = adjacentCells.filter(
        ({ row: r, col: c }) => !board[r][c].isRevealed
      );
      
      // Set the insufficient flag cells
      setInsufficientFlagCells(unrevealed);
      
      // Clear the highlight after a short delay
      setTimeout(() => {
        setInsufficientFlagCells([]);
      }, 200);
    }
  };

  // Reveal a cell
  const revealCell = (row: number, col: number) => {
    if (gameOver || gameWon || board[row][col].marking === "flag") {
      return;
    }
    
    // If the cell is already revealed, handle as chord click
    if (board[row][col].isRevealed) {
      handleChordClick(row, col);
      return;
    }
    
    // Start timer on first click
    if (startTime === null) {
      setStartTime(Date.now());
    }
    
    const newBoard = [...board];
    
    // Game over if mine is clicked
    if (newBoard[row][col].isMine) {
      // Reveal all mines
      for (let r = 0; r < newBoard.length; r++) {
        for (let c = 0; c < newBoard[0].length; c++) {
          if (newBoard[r][c].isMine) {
            newBoard[r][c].isRevealed = true;
          }
        }
      }
      setBoard(newBoard);
      setGameOver(true);
      return;
    }
    
    // Reveal the cell
    revealCellRecursive(newBoard, row, col);
    setBoard(newBoard);
    
    // Check if game is won
    checkWinCondition(newBoard);
  };

  // Recursively reveal cells (flood fill for empty cells)
  const revealCellRecursive = (board: CellState[][], row: number, col: number) => {
    const rows = board.length;
    const cols = board[0].length;
    
    if (
      row < 0 || row >= rows || col < 0 || col >= cols ||
      board[row][col].isRevealed || board[row][col].marking === "flag" || board[row][col].isMine
    ) {
      return;
    }
    
    board[row][col].isRevealed = true;
    board[row][col].isNew = true; // Mark as newly revealed for animation
    board[row][col].marking = "none"; // Clear any marking when revealed
    
    // If it's an empty cell, reveal neighbors
    if (board[row][col].neighborMines === 0) {
      for (let r = Math.max(0, row - 1); r <= Math.min(rows - 1, row + 1); r++) {
        for (let c = Math.max(0, col - 1); c <= Math.min(cols - 1, col + 1); c++) {
          if (r !== row || c !== col) {
            revealCellRecursive(board, r, c);
          }
        }
      }
    }
  };

  // Clear the "new" flag after animation completes
  useEffect(() => {
    if (board.some(row => row.some(cell => cell.isNew))) {
      const timer = setTimeout(() => {
        setBoard(prevBoard => {
          const newBoard = [...prevBoard];
          for (let r = 0; r < newBoard.length; r++) {
            for (let c = 0; c < newBoard[0].length; c++) {
              if (newBoard[r][c].isNew) {
                newBoard[r][c] = { ...newBoard[r][c], isNew: false };
              }
            }
          }
          return newBoard;
        });
      }, 300); // Match this with the CSS animation duration
      
      return () => clearTimeout(timer);
    }
  }, [board]);

  // Cycle through cell markings (none -> flag -> question -> none)
  const cycleCellMarking = (row: number, col: number, e: React.MouseEvent) => {
    e.preventDefault(); // Prevent context menu
    
    if (gameOver || gameWon || board[row][col].isRevealed) {
      return;
    }
    
    // Start timer on first click
    if (startTime === null) {
      setStartTime(Date.now());
    }
    
    const newBoard = [...board];
    const cell = newBoard[row][col];
    
    // Cycle through markings: none -> flag -> question -> none
    if (cell.marking === "none") {
      cell.marking = "flag";
    } else if (cell.marking === "flag") {
      cell.marking = "question";
    } else {
      cell.marking = "none";
    }
    
    setBoard(newBoard);
    
    // Update flag count
    setFlagCount(
      newBoard.flat().filter(cell => cell.marking === "flag").length
    );
    
    // Check if game is won
    checkWinCondition(newBoard);
  };

  // Add score to scoreboard
  const addScore = () => {
    const newScore: Score = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      time: parseFloat(elapsedTimeMs.toFixed(2)),
      difficulty,
    };
    
    setScores(prevScores => [...prevScores, newScore]);
  };

  // Check if the game is won
  const checkWinCondition = (board: CellState[][]) => {
    const { mines } = difficultySettings[difficulty];
    const totalCells = board.length * board[0].length;
    const revealedCells = board.flat().filter(cell => cell.isRevealed).length;
    
    // Game is won if all non-mine cells are revealed
    if (revealedCells === totalCells - mines) {
      // Flag all mines
      const newBoard = [...board];
      for (let r = 0; r < newBoard.length; r++) {
        for (let c = 0; c < newBoard[0].length; c++) {
          if (newBoard[r][c].isMine) {
            newBoard[r][c].marking = "flag";
          }
        }
      }
      setBoard(newBoard);
      setGameWon(true);
      setFlagCount(mines);
      
      // Add score to scoreboard
      addScore();
    }
  };

  // Get cell color based on neighbor count
  const getNumberColor = (count: number) => {
    const colors = [
      "", // 0 has no color
      "text-blue-600", // 1
      "text-green-600", // 2
      "text-red-600", // 3
      "text-purple-800", // 4
      "text-yellow-600", // 5
      "text-teal-600", // 6
      "text-black", // 7
      "text-gray-600", // 8
    ];
    return colors[count] || "";
  };

  // Check if a cell is in the affected cells list
  const isAffectedCell = (row: number, col: number) => {
    return affectedCells.some(cell => cell.row === row && cell.col === col);
  };

  // Check if a cell is in the insufficient flag cells list
  const isInsufficientFlagCell = (row: number, col: number) => {
    return insufficientFlagCells.some(cell => cell.row === row && cell.col === col);
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Format difficulty for display
  const formatDifficulty = (diff: Difficulty) => {
    const difficultyMap = {
      beginner: "Beginner",
      intermediate: "Intermediate",
      expert: "Expert",
    };
    return difficultyMap[diff];
  };

  // Sort scores
  const sortedScores = [...scores].sort((a, b) => {
    if (sortField === "date") {
      return sortDirection === "asc"
        ? new Date(a.date).getTime() - new Date(b.date).getTime()
        : new Date(b.date).getTime() - new Date(a.date).getTime();
    } else if (sortField === "time") {
      return sortDirection === "asc" ? a.time - b.time : b.time - a.time;
    } else {
      // difficulty
      const difficultyOrder = { beginner: 1, intermediate: 2, expert: 3 };
      return sortDirection === "asc"
        ? difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty]
        : difficultyOrder[b.difficulty] - difficultyOrder[a.difficulty];
    }
  });

  // Toggle sort direction
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Clear all scores
  const clearScores = () => {
    if (window.confirm("Are you sure you want to delete all records?")) {
      setScores([]);
    }
  };

  // Render the game board
  return (
    <div className="flex flex-col items-center">
      {/* Game controls */}
      <div className="mb-4 flex gap-4">
        <select
          className="px-3 py-2 border rounded"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as Difficulty)}
        >
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="expert">Expert</option>
        </select>
        
        <button
          className="px-3 py-2 bg-blue-500 text-white rounded flex items-center gap-1"
          onClick={initializeBoard}
        >
          <RefreshCw size={16} /> New Game
        </button>
        
        <button
          className="px-3 py-2 bg-green-500 text-white rounded flex items-center gap-1"
          onClick={() => setShowScoreboard(!showScoreboard)}
        >
          <Award size={16} /> {showScoreboard ? "Back to Game" : "View Records"}
        </button>
      </div>
      
      {showScoreboard ? (
        <div className="w-full max-w-2xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Personal Records</h2>
            {scores.length > 0 && (
              <button
                className="px-2 py-1 bg-red-500 text-white rounded text-sm"
                onClick={clearScores}
              >
                Delete Records
              </button>
            )}
          </div>
          
          {scores.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No records yet. Records will be saved when you complete a game.
            </div>
          ) : (
            <div className="border rounded overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th
                      className="px-4 py-2 text-left cursor-pointer hover:bg-gray-200"
                      onClick={() => toggleSort("date")}
                    >
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        Date
                        {sortField === "date" && (
                          <ArrowUpDown
                            size={14}
                            className={`ml-1 ${
                              sortDirection === "asc" ? "transform rotate-180" : ""
                            }`}
                          />
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-2 text-left cursor-pointer hover:bg-gray-200"
                      onClick={() => toggleSort("time")}
                    >
                      <div className="flex items-center gap-1">
                        <Clock size={14} />
                        Time
                        {sortField === "time" && (
                          <ArrowUpDown
                            size={14}
                            className={`ml-1 ${
                              sortDirection === "asc" ? "transform rotate-180" : ""
                            }`}
                          />
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-2 text-left cursor-pointer hover:bg-gray-200"
                      onClick={() => toggleSort("difficulty")}
                    >
                      <div className="flex items-center gap-1">
                        <Award size={14} />
                        Difficulty
                        {sortField === "difficulty" && (
                          <ArrowUpDown
                            size={14}
                            className={`ml-1 ${
                              sortDirection === "asc" ? "transform rotate-180" : ""
                            }`}
                          />
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedScores.map((score) => (
                    <tr key={score.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-2">{formatDate(score.date)}</td>
                      <td className="px-4 py-2">{score.time.toFixed(2)}s</td>
                      <td className="px-4 py-2">{formatDifficulty(score.difficulty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Game info */}
          <div className="flex justify-between w-full mb-4 px-2">
            <div className="flex items-center gap-1">
              <Flag size={16} className="text-red-600" />
              <span>{flagCount} / {difficultySettings[difficulty].mines}</span>
            </div>
            <div>Time: {elapsedTimeMs.toFixed(2)}s</div>
          </div>
          
          {/* Game board */}
          <div className="border-2 border-gray-400 bg-gray-200 p-2">
            {board.map((row, rowIndex) => (
              <div key={rowIndex} className="flex">
                {row.map((cell, colIndex) => (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    className={`
                      w-8 h-8 flex items-center justify-center font-bold
                      border border-gray-400 select-none
                      ${cell.isRevealed 
                        ? cell.isMine 
                          ? "bg-red-500" 
                          : cell.neighborMines > 0
                            ? "bg-gray-300 hover:bg-gray-400 cursor-pointer"
                            : "bg-gray-300" 
                        : isInsufficientFlagCell(rowIndex, colIndex)
                          ? "bg-red-200 animate-pulse"
                          : isAffectedCell(rowIndex, colIndex)
                            ? "bg-yellow-200 hover:bg-yellow-300 cursor-pointer"
                            : "bg-gray-200 hover:bg-gray-300 cursor-pointer"}
                      ${cell.isNew ? "animate-reveal" : ""}
                      transition-all duration-200
                    `}
                    onClick={() => revealCell(rowIndex, colIndex)}
                    onContextMenu={(e) => cycleCellMarking(rowIndex, colIndex, e)}
                    onMouseEnter={() => handleMouseEnter(rowIndex, colIndex)}
                    onMouseLeave={handleMouseLeave}
                  >
                    {cell.isRevealed ? (
                      cell.isMine ? (
                        <Bomb size={16} />
                      ) : cell.neighborMines > 0 ? (
                        <span className={getNumberColor(cell.neighborMines)}>
                          {cell.neighborMines}
                        </span>
                      ) : null
                    ) : cell.marking === "flag" ? (
                      <Flag size={16} className="text-red-600" />
                    ) : cell.marking === "question" ? (
                      <HelpCircle size={16} className="text-blue-600" />
                    ) : null}
                  </div>
                ))}
              </div>
            ))}
          </div>
          
          {/* Game status */}
          {gameOver && (
            <div className="mt-4 text-xl text-red-600 font-bold">
              Game Over! You hit a mine.
            </div>
          )}
          {gameWon && (
            <div className="mt-4 text-xl text-green-600 font-bold">
              Congratulations! You found all mines! (Time: {elapsedTimeMs.toFixed(2)}s)
            </div>
          )}
          
          {/* Game instructions */}
          <div className="mt-6 text-sm text-gray-600 max-w-md">
            <h3 className="font-bold mb-1">How to Play:</h3>
            <ul className="list-disc pl-5">
              <li>Left click: Reveal a cell</li>
              <li>Right click: Cycle marking (None → Flag → Question → None)</li>
              <li>Click on a number: Reveal adjacent cells if enough flags are placed</li>
              <li>Hover over a number: Highlights affected cells in yellow</li>
              <li>If flags are insufficient when clicking a number, adjacent cells flash red</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
};

export default Minesweeper;
