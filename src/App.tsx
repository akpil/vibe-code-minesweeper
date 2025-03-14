import { useState } from "react";
import "./App.css";
import Minesweeper from "./components/Minesweeper";

function App() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-3xl font-bold mb-4">Minesweeper</h1>
      <Minesweeper />
    </div>
  );
}

export default App;
