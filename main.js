"use strict";

window.addEventListener('load', main);

const STATE_HIDDEN = "hidden";
const STATE_SHOWN = "shown";
const STATE_MARKED = "marked";

function array2d(nrows, ncols, val) {
    const res = [];
    for (let row = 0; row < nrows; row++) {
        res[row] = [];
        for (let col = 0; col < ncols; col++)
            res[row][col] = val(row, col);
    }
    return res;
}

function rndInt(min, max) {
    [min, max] = [Math.ceil(min), Math.floor(max)]
    return min + Math.floor(Math.random() * (max - min + 1));
}

function prepare_dom(s) {
    const grid = document.querySelector(".grid");
    const nCards = 24 * 20; // max grid size
    for (let i = 0; i < nCards; i++) {
        const card = document.createElement("div");
        card.className = "card";
        card.setAttribute("data-cardInd", i);
        card.addEventListener("click", () => {
            card_click_cb(s, card, i);
        });
        card.addEventListener("contextmenu", function (event) {
            mark(s, card, i);
            render(s);
            event.preventDefault();
            return false;
        }, false)
        grid.appendChild(card);
    }
}

function validCoord(s, row, col) {
    return row >= 0 && row < s.rows && col >= 0 && col < s.cols;
}

function count(s, row, col) {
    const c = (s, r, c) =>
        (validCoord(s, r, c) && s.cells[r][c].mine ? 1 : 0);
    let res = 0;
    for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++)
            res += c(s, row + dr, col + dc);
    return res;
}

function sprinkleMines(s, ind) {

    const col = ind % s.cols;
    const row = Math.floor(ind / s.cols);

    let allowed = [];
    for (let r = 0; r < s.rows; r++) {
        for (let c = 0; c < s.cols; c++) {
            if (Math.abs(row - r) > 2 || Math.abs(col - c) > 2)
                allowed.push([r, c]);
        }
    }
    s.minecount = Math.min(s.minecount, allowed.length);
    for (let i = 0; i < s.minecount; i++) {
        let j = rndInt(i, allowed.length - 1);
        [allowed[i], allowed[j]] = [allowed[j], allowed[i]];
        let [r, c] = allowed[i];
        s.cells[r][c].mine = true;
    }

    for (let r = 0; r < s.rows; r++) {
        for (let c = 0; c < s.cols; c++) {
            if (s.cells[r][c].state == STATE_MARKED) {
                s.cells[r][c].state = STATE_HIDDEN;
                s.markedcount--;
            }
            s.cells[r][c].count = count(s, r, c);
        }
    }
    let mines = []; let counts = [];
    for (let row = 0; row < s.rows; row++) {
        let str = "";
        for (let col = 0; col < s.cols; col++) {
            str += s.cells[row][col].mine ? "B" : ".";
        }
        str += "  |  ";
        for (let col = 0; col < s.cols; col++) {
            str += s.cells[row][col].count.toString();
        }
        mines[row] = str;
    }
    console.log("Mines and counts after sprinkling:");
    console.log(mines.join("\n"), "\n");
}

function uncover(s, card_div, ind) {
    const col = ind % s.cols;
    const row = Math.floor(ind / s.cols);

    if (!validCoord(s, row, col)) return false;
    if (s.uncoveredcount === 0)
        sprinkleMines(s, ind);
    // if cell is not hidden, ignore this move
    if (s.cells[row][col].state !== STATE_HIDDEN) return false;
    // floodfill all 0-count cells
    const ff = (r, c) => {
        if (!validCoord(s, r, c)) return;
        if (s.cells[r][c].state !== STATE_HIDDEN) return;
        s.cells[r][c].state = STATE_SHOWN;
        s.uncoveredcount++;
        if (s.cells[r][c].count !== 0) return;
        ff(r - 1, c - 1); ff(r - 1, c); ff(r - 1, c + 1);
        ff(r, c - 1);; ff(r, c + 1);
        ff(r + 1, c - 1); ff(r + 1, c); ff(r + 1, c + 1);
    };
    ff(row, col);
    // have we hit a mine?
    if (s.cells[row][col].mine) {
        s.exploded = true;
    }
    render(s);
    console.log(getRendering(s));
    console.log("%d have been uncovered out of a total of %d cells (%d uncleared cells)", s.uncoveredcount, s.rows * s.cols, (s.rows * s.cols - s.uncoveredcount - s.minecount));
    return true;
}

function mark(s, card_div, ind) {
    const col = ind % s.cols;
    const row = Math.floor(ind / s.cols);
    // if coordinates invalid, refuse this request
    if (!validCoord(s, row, col)) return false;
    if (s.markedcount == s.minecount  && s.cells[row][col].state != STATE_MARKED) return false;
    // if cell already uncovered, refuse this
    if (s.cells[row][col].state === STATE_SHOWN) return false;
    // accept the move and flip the marked status
    s.markedcount += s.cells[row][col].state == STATE_MARKED ? -1 : 1;
    s.cells[row][col].state = s.cells[row][col].state == STATE_MARKED ?
        STATE_HIDDEN : STATE_MARKED;
    return true;
}

function card_click_cb(s, card_div, ind) {
    const col = ind % s.cols;
    const row = Math.floor(ind / s.cols);
    console.log("left click at index %d which has %d mines", ind, s.cells[row][col].count);
    uncover(s, card_div, ind);
    document.querySelectorAll(".endTime").forEach(
        (e)=> {
          let end = new Date();
          e.textContent = String(Math.floor((end-s.start)/1000));
      });
    if (s.uncoveredcount == (s.cols * s.rows - s.minecount)) {
        document.querySelector("#overlaywin").classList.toggle("active");
    }
    if (s.exploded) {
        document.querySelector("#overlayloss").classList.toggle("active");
    }
}

function menu_button_cb(s, cols, rows) {
    let mines = 0;
    if (cols == 10)
        mines = 10;
    else if (cols == 18)
        mines = 40;
    else if (cols == 24)
        mines = 99;
    init(s, cols, rows, mines);
    clear(s);
    render(s);
}


function render(s) {
    const grid = document.querySelector(".grid");
    grid.style.gridTemplateColumns = `repeat(${s.cols}, 1fr)`;
    for (let i = 0; i < grid.children.length; i++) {
        const card = grid.children[i];
        const ind = Number(card.getAttribute("data-cardInd"));
        const col = ind % s.cols;
        const row = Math.floor(ind / s.cols);
        if (ind >= s.rows * s.cols) {
            card.style.display = "none";
        }
        else {
            card.style.display = "block";
            if (s.cells[row][col].state == STATE_SHOWN) {
                card.classList.add("shown");
                if (!s.cells[row][col].mine == true) {
                    switch (s.cells[row][col].count) {
                        case 1:
                            card.classList.add("one");
                            break;
                        case 2:
                            card.classList.add('two');
                            break;
                        case 3:
                            card.classList.add('three');
                            break;
                        case 4:
                            card.classList.add('four');
                            break;
                        case 5:
                            card.classList.add('five');
                            break;
                        case 6:
                            card.classList.add('six');
                            break;
                        case 7:
                            card.classList.add('seven');
                            break;
                        case 8:
                            card.classList.add('eight');
                            break;
                        default:
                            card.classList.add('none');
                            break;
                    }
                }
            }
            if (s.exploded && s.cells[row][col].mine == true) {
                card.classList.remove("shown");
                card.classList.add("exploded");

            }
            if (s.cells[row][col].state == STATE_MARKED)
                card.classList.add("marked");
            else
                card.classList.remove("marked");
        }
    }
    document.querySelectorAll(".mineCount").forEach(
        (e) => {
            e.textContent = String(s.minecount);
        });

    document.querySelectorAll(".flagCount").forEach(
        (e) => {
            e.textContent = String(s.minecount - s.markedcount);
        });
}

function getRendering(s) {
    const res = [];
    for (let row = 0; row < s.rows; row++) {
        let str = "";
        for (let col = 0; col < s.cols; col++) {
            let a = s.cells[row][col];
            if (s.exploded && a.mine) str += "M";
            else if (a.state === STATE_HIDDEN) str += "H";
            else if (a.state === STATE_MARKED) str += "F";
            else if (a.mine) str += "M";
            else str += a.count.toString();
        }
        res[row] = str;
    }
    return res;
}

function clear(s) {
    const grid = document.querySelector(".grid");
    grid.style.gridTemplateColumns = `repeat(${s.cols}, 1fr)`;
    for( let i = 0 ; i < grid.children.length ; i ++) {
      const card = grid.children[i];
      card.classList.remove("uncovered");
      card.classList.remove("marked");
      card.classList.remove("exploded");
      card.classList.remove("none");
      card.classList.remove("one");
      card.classList.remove("two");
      card.classList.remove("three");
      card.classList.remove("four");
      card.classList.remove("five");
      card.classList.remove("six");
      card.classList.remove("seven");
      card.classList.remove("eight");
      card.innerHTML = "";
    }
}

function init(s, cols, rows, mines) {
    s.cols = cols;
    s.rows = rows;
    s.minecount = mines;
    s.uncoveredcount = 0;
    s.markedcount = 0;
    s.exploded = false;
    s.start = new Date();
    s.cells = array2d(rows, cols, () => ({ mine: false, state: STATE_HIDDEN, count: 0 }));

}

function main() {

    let state = {
        cols: 10,
        rows: 8,
        minecount: 10,
        uncoveredcount: 0,
        markedcount: 0,
        exploded: false,
        start: null,
        cells: array2d(8, 10, () => ({ mine: false, state: STATE_HIDDEN, count: 0 }))
    }

    document.querySelectorAll(".menuButton").forEach((button) => {
        let [rows, cols] = button.getAttribute("data-size").split("x").map(s => Number(s));
        button.innerHTML = `${cols} &#x2715; ${rows}`
        button.addEventListener("click", menu_button_cb.bind(null, state, cols, rows));
    });

    document.querySelector("#overlaywin").addEventListener("click", () => {
        document.querySelector("#overlaywin").classList.remove("active");
        menu_button_cb(state, state.cols, state.rows);
        render(state);
    });

    // callback for overlay click - hide overlay and regenerate game
    document.querySelector("#overlayloss").addEventListener("click", () => {
        document.querySelector("#overlayloss").classList.remove("active");
        menu_button_cb(state, state.cols, state.rows);
        render(state);
    });

    prepare_dom(state);
    init(state, 10, 8, 10);
    render(state);

    setInterval(() => {
        document.querySelectorAll(".time").forEach(
            (e)=> {
              let end = new Date();
              e.textContent = String(Math.floor((end-state.start)/1000))+" seconds";
          });
      }, 500);
}
