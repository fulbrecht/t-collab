import { socket } from './socketService.js';
import * as state from './state.js';
import { renderTAccounts, buildTAccountStructure } from './tAccountRenderer.js';
import { renderTransactionList } from './transactionRenderer.js';
import { svgWidth, tAccountWidth, tAccountHeight } from './config.js';

export function addNewTAccount() {
    const newId = `tAcc-${Date.now()}`;
    const accountsPerRow = Math.floor((svgWidth - 20) / (tAccountWidth + 10));
    const newIndex = state.getAccounts().length;
    const col = newIndex % accountsPerRow;
    const row = Math.floor(newIndex / accountsPerRow);
    const newX = 10 + col * (tAccountWidth + 10);
    const newY = 10 + row * (tAccountHeight + 10);

    const newAccountData = {
        id: newId, title: `Account ${state.getAccounts().length + 1}`,
        debits: [], credits: [], totalDebits: 0, totalCredits: 0,
        x: newX, y: newY,
    };
    state.boxData.push(newAccountData); // Directly modify for now, or use state.addAccount
    renderTAccounts();
    socket.emit('addAccount', newAccountData);
}

export function deleteAccount(accountId) {
    const account = state.findAccountById(accountId);
    if (account) {
        const deletedAccountTitle = account.title;
        state.setBoxData(state.getAccounts().filter(acc => acc.id !== accountId));
        renderTAccounts();
        socket.emit('deleteAccount', accountId);
        console.log(`Account "${deletedAccountTitle}" (ID: ${accountId}) deleted locally and request sent to server.`);
    }
}

export function clearAllData() {
    state.setBoxData([]);
    state.setTransactions([]);
    renderTAccounts();
    renderTransactionList();
    socket.emit('clearAllAccounts');
    console.log('All T-accounts and transactions cleared locally and request sent to server.');
}

export function arrangeTAccounts() {
    if (state.getAccounts().length === 0) return;
    const padding = 10;
    const accountsPerRow = Math.max(1, Math.floor((svgWidth - padding) / (tAccountWidth + padding)));
    state.getAccounts().forEach((account, index) => {
        const col = index % accountsPerRow;
        const row = Math.floor(index / accountsPerRow);
        account.x = padding + col * (tAccountWidth + padding);
        account.y = padding + row * (tAccountHeight + padding);
    });
    renderTAccounts();
    socket.emit('accountsArranged', state.getAccounts());
    console.log('T-accounts arranged locally and new layout sent to server.');
}

export function showRenameInput(d, groupElement, titleTextElement) {
    d3.select(titleTextElement).style("visibility", "hidden");
    const textScreenBBox = titleTextElement.getBoundingClientRect();
    const input = d3.select("body").append("input")
        .attr("type", "text").attr("class", "rename-input")
        .style("left", `${textScreenBBox.left}px`).style("top", `${textScreenBBox.top}px`)
        .style("width", `${textScreenBBox.width}px`).style("min-width", "100px").style("height", `${textScreenBBox.height}px`)
        .property("value", d.title)
        .on("keypress", function(event) {
            if (event.key === "Enter") { event.preventDefault(); this.blur(); }
        })
        .on("blur", function() {
            const newTitle = this.value.trim();
            d.title = newTitle || "Untitled";
            groupElement.select(".t-account-title-text").text(d.title).style("visibility", "visible");
            d3.select(this).remove();
            socket.emit('renameAccount', { id: d.id, title: d.title });
        });
    input.node().focus();
    input.node().select();

    const tempSpan = d3.select("body").append("span")
        .style("font-size", "16px").style("font-weight", "bold").style("font-family", "sans-serif")
        .style("visibility", "hidden").style("position", "absolute").text(d.title);
    const textWidth = tempSpan.node().getBoundingClientRect().width;
    tempSpan.remove();
    if (textWidth > textScreenBBox.width) {
        input.style("width", `${textWidth + 10}px`);
    }
}