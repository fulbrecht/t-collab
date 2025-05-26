// --- Global Variables & Constants ---
const socket = io(); // Connects to the server that serves the page

// Define dimensions for SVG and the box
const svgWidth = 800;
const svgHeight = 600;

// T-Account dimensions
const tAccountWidth = 200;
const tAccountHeight = 250;
const headerHeight = 40; // Height for the title area
const totalsHeight = 30; // Height for the totals area at the bottom
const columnLabelYOffset = headerHeight + 20; // Y position for "Debits"/"Credits" labels

// Create SVG container
const svg = d3.select("body").append("svg")
    .attr("width", svgWidth)
    .attr("height", svgHeight);

// Data array for all T-Accounts
let boxData = [];
// Array to store transactions (client-side)
let transactions = [];


// --- Helper function to build T-Account SVG elements ---
function buildTAccountStructure(selection) {
    // Main bounding box for the T-Account
    selection.append("rect")
        .attr("class", "t-account-box")
        .attr("width", tAccountWidth)
        .attr("height", tAccountHeight);

    // Account Title
    selection.append("text")
        .attr("class", "t-account-title-text")
        .attr("x", tAccountWidth / 2)
        .attr("y", headerHeight / 2)
        .text(d => d.title)
        .style("pointer-events", "auto") // Make the title text itself clickable
        .on("dblclick", function(event, d) {
            event.stopPropagation(); // Prevent drag from starting on double click
            const groupElement = d3.select(this.parentNode); // Get the <g> element
            showRenameInput(d, groupElement, this); // Pass data, group, and title text element
        });

    // Horizontal line below the title (top of the T)
    selection.append("line")
        .attr("class", "t-account-line")
        .attr("x1", 0).attr("y1", headerHeight)
        .attr("x2", tAccountWidth).attr("y2", headerHeight);

    // Vertical line (stem of the T)
    selection.append("line")
        .attr("class", "t-account-line")
        .attr("x1", tAccountWidth / 2).attr("y1", headerHeight)
        .attr("x2", tAccountWidth / 2).attr("y2", tAccountHeight - totalsHeight);

    // "Debits" label
    // Delete button (e.g., an "X" in the top-right corner)
    selection.append("text")
        .attr("class", "delete-account-btn")
        .attr("x", tAccountWidth - 10) // Position X (10px from the right edge)
        .attr("y", 15)                 // Position Y (15px from the top edge)
        .style("cursor", "pointer")
        .style("font-size", "18px")
        .style("fill", "#E74C3C") // A reddish color for delete
        .style("pointer-events", "auto") // Ensure it's clickable
        .text("X")
        .on("click", function(event, d) {
            event.stopPropagation(); // Prevent drag or other parent events
            if (confirm(`Are you sure you want to delete account "${d.title}"?`)) {
                deleteAccount(d.id);
            }
        });

    selection.append("text")
        .attr("class", "t-account-column-label")
        .attr("x", tAccountWidth / 4) // Center in the left column
        .attr("y", columnLabelYOffset)
        .text("Debits");

    // "Credits" label
    selection.append("text")
        .attr("class", "t-account-column-label")
        .attr("x", (tAccountWidth / 4) * 3) // Center in the right column
        .attr("y", columnLabelYOffset)
        .text("Credits");

    // Horizontal line above totals
    selection.append("line")
        .attr("class", "t-account-line")
        .attr("x1", 0).attr("y1", tAccountHeight - totalsHeight)
        .attr("x2", tAccountWidth).attr("y2", tAccountHeight - totalsHeight);

    // "Total Debits" text (placeholder)
    selection.append("text")
        .attr("class", "debit-total t-account-total-text") // Added t-account-total-text for consistent styling
        .attr("x", tAccountWidth / 4) // Keep x for general centering
        .attr("y", tAccountHeight - totalsHeight / 2)
        .text(d => `Total Dr: ${d.totalDebits.toFixed(2)}`);

    // "Total Credits" text (placeholder)
    selection.append("text")
        .attr("class", "credit-total t-account-total-text") // Added t-account-total-text for consistent styling
        .attr("x", (tAccountWidth / 4) * 3) // Keep x for general centering
        .attr("y", tAccountHeight - totalsHeight / 2)
        .text(d => `Total Cr: ${d.totalCredits.toFixed(2)}`);
}

// --- Main rendering function for T-Accounts ---
function renderTAccounts() {
    const groups = svg.selectAll(".draggable-group")
        .data(boxData, d => d.id); // Use `d.id` as the key function

    // Exit: Remove groups for accounts that no longer exist
    groups.exit().remove();

    // Enter: Create new groups for new accounts
    const newGroups = groups.enter()
        .append("g")
        .attr("class", "draggable-group")
        .attr("transform", d => `translate(${d.x}, ${d.y})`)
        .call(d3.drag() // Apply drag behavior to new groups
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));

    buildTAccountStructure(newGroups); // Build the visual elements for new T-accounts

    // Update: Update existing groups
    const allGroups = groups.merge(newGroups); // Combine enter and update selections

    allGroups.each(function(d) { // d is the T-account data
        const group = d3.select(this);

        // Update totals
        group.select(".debit-total").text(`Total Dr: ${d.totalDebits.toFixed(2)}`);
        group.select(".credit-total").text(`Total Cr: ${d.totalCredits.toFixed(2)}`);

        // --- Render Debit Entries ---
        const debitEntries = group.selectAll(".debit-entry-text")
            .data(d.debits, entry => entry.id); // Assuming entries will have unique IDs
        
        const debitTexts = debitEntries.enter().append("text")
            .attr("class", "debit-entry-text") // Consider adding a general .entry-text class for common styles
            .attr("x", tAccountWidth / 4)
            .attr("y", (entry, i) => columnLabelYOffset + 20 + (i * 15)) // Position below "Debits" label
            .merge(debitEntries) // Combine enter and update
            .text(entry => entry.amount.toFixed(2)); // Or entry.description
        debitEntries.exit().remove();
        debitTexts.attr("data-transaction-id", entry => entry.transactionId); // Add transaction ID for highlighting
        // --- Render Credit Entries ---
        const creditEntries = group.selectAll(".credit-entry-text")
            .data(d.credits, entry => entry.id);
        const creditTexts = creditEntries.enter().append("text")
            .attr("class", "credit-entry-text") // Consider adding a general .entry-text class
            .attr("x", (tAccountWidth / 4) * 3)
            .attr("y", (entry, i) => columnLabelYOffset + 20 + (i * 15)) // Position below "Credits" label
            .merge(creditEntries)
            .text(entry => entry.amount.toFixed(2));
        creditEntries.exit().remove();
        creditTexts.attr("data-transaction-id", entry => entry.transactionId); // Add transaction ID for highlighting
    });

    groups.attr("transform", d => `translate(${d.x}, ${d.y})`); // Ensure positions are correct
}


// --- Socket.IO Client-Side Integration ---

// Listen for the initial state (all accounts) from the server
socket.on('initialAccounts', (serverAccounts) => {
    console.log('Received initial accounts:', serverAccounts);
    boxData = serverAccounts; // Overwrite local data with server's authoritative list
    renderTAccounts();
});

socket.on('initialTransactions', (serverTransactions) => {
    console.log('Received initial transactions:', serverTransactions);
    transactions = serverTransactions; // Overwrite local transactions with server's list
    renderTransactionList(); // Render the list based on this initial data
});

// Listen for a new account added by another client (or this client, echoed by server)
socket.on('newAccountAdded', (accountData) => {
    console.log('Received new account from server:', accountData);
    const exists = boxData.some(acc => acc.id === accountData.id);
    if (!exists) {
        boxData.push(accountData);
        renderTAccounts();
    } else {
        console.log(`Account ${accountData.id} already exists locally.`);
        // Optionally, update existing account data if necessary
        const existingAccount = boxData.find(acc => acc.id === accountData.id);
        Object.assign(existingAccount, accountData); // Merge properties
        renderTAccounts(); // Re-render to reflect any changes
    }
});

// Listen for position updates from other clients (via server)
socket.on('boxPositionUpdate', (data) => { // data = { id, x, y }
    console.log('Received box position update:', data);
    const accountToUpdate = boxData.find(acc => acc.id === data.id);
    if (accountToUpdate) {
        accountToUpdate.x = data.x;
        accountToUpdate.y = data.y;
        // Find the specific group and update its transform directly
        // This is more efficient than a full re-render for just position
        svg.selectAll(".draggable-group")
            .filter(d => d.id === data.id)
            .attr("transform", `translate(${data.x}, ${data.y})`);
    } else {
        console.warn(`Account with id ${data.id} not found for position update.`);
        // It's possible this account hasn't been added yet if messages are out of order
        // A full renderTAccounts() might be a fallback, or wait for newAccountAdded
    }
});

// Listen for server confirmation/broadcast that all accounts were cleared
socket.on('allAccountsCleared', () => {
    console.log('Received allAccountsCleared from server.');
    boxData = [];
    transactions = []; // Also clear transactions
    renderTAccounts();
    renderTransactionList(); // And re-render the transaction list
});

// Listen for server broadcast of an arranged layout
socket.on('accountsArrangedUpdate', (arrangedData) => {
    console.log('Received accountsArrangedUpdate from server.');
    if (Array.isArray(arrangedData)) {
        boxData = arrangedData; // Replace local data with the new layout
        renderTAccounts();
    } else {
        console.error('Received invalid data for accountsArrangedUpdate:', arrangedData);
    }
});

// Listen for title updates from other clients (via server)
socket.on('accountTitleUpdate', (data) => { // data = { id, title }
    console.log('Received accountTitleUpdate from server:', data);
    const accountToUpdate = boxData.find(acc => acc.id === data.id);
    if (accountToUpdate) {
        accountToUpdate.title = data.title;
        // Update the text of the specific T-account's title in the SVG
        svg.selectAll(".draggable-group")
            .filter(d_svg => d_svg.id === data.id) // d_svg to avoid conflict with outer d
            .select(".t-account-title-text").text(data.title);
    }
});

// Listen for an account being deleted by another client (via server)
socket.on('accountDeleted', (accountId) => {
    console.log('Received accountDeleted from server for ID:', accountId);
    const index = boxData.findIndex(acc => acc.id === accountId);
    if (index > -1) {
        boxData.splice(index, 1);
        renderTAccounts();
        console.log(`Account ${accountId} removed locally.`);
    }
});

// Listen for new transaction added by server (or other client)
socket.on('transactionAdded', (transaction) => {
    console.log('Received transactionAdded from server:', transaction);
    // This is a simplified update. A more robust system would apply
    // the transaction to the local data. For now, we assume the server
    // might send updated account data or we might need to re-fetch.
    // For a quick test, if the server sends all accounts, we can just update:
    // if (transaction.updatedAccounts) {
    // A more robust client-side processing of the transaction:
    if (transaction && transaction.entries) {
        // Ensure the transaction is added to the local list if it's not already there
        if (!transactions.find(t => t.id === transaction.id)) {
            transactions.push(transaction);
        }
        processTransaction(transaction, false); // Process without re-emitting to server
    }
});

// --- End Socket.IO Integration ---

// Define drag behavior
function dragstarted(event, d) {
    d3.select(this).raise().classed("dragging", true);
}

function dragged(event, d) {
    // d is the data object bound to the dragged element
    // Calculate the new potential x and y
    let newX = event.x;
    let newY = event.y;

    // Constrain the new position within the SVG boundaries
    // Math.max ensures the box doesn't go past the left/top edge
    // Math.min ensures the box doesn't go past the right/bottom edge
    d.x = Math.max(0, Math.min(newX, svgWidth - tAccountWidth));
    d.y = Math.max(0, Math.min(newY, svgHeight - tAccountHeight));

    d3.select(this).attr("transform", `translate(${d.x}, ${d.y})`);

    // 3. Emit the new position to the server
    socket.emit('boxMoved', { id: d.id, x: d.x, y: d.y });
}

function dragended(event, d) {
    d3.select(this).classed("dragging", false);
}

// --- Function to add a new T-Account ---
function addNewTAccount() {
    const newId = `tAcc-${Date.now()}`; // Generate a unique ID

    // Basic positioning for new accounts to avoid overlap
    const accountsPerRow = Math.floor((svgWidth - 20) / (tAccountWidth + 10));
    const newIndex = boxData.length;
    const col = newIndex % accountsPerRow;
    const row = Math.floor(newIndex / accountsPerRow);
    const newX = 10 + col * (tAccountWidth + 10);
    const newY = 10 + row * (tAccountHeight + 10);

    const newAccountData = {
        id: newId,
        title: `Account ${boxData.length + 1}`, // Simple default title
        debits: [], // Initialize debit entries array
        credits: [], // Initialize credit entries array
        totalDebits: 0,
        totalCredits: 0,
        x: newX,
        y: newY,
    };
    boxData.push(newAccountData);
    renderTAccounts(); // Re-render all T-accounts
    socket.emit('addAccount', newAccountData); // Notify server about the new account
}

// --- Function to delete a T-Account ---
function deleteAccount(accountId) {
    const index = boxData.findIndex(acc => acc.id === accountId);
    if (index > -1) {
        const deletedAccountTitle = boxData[index].title;
        boxData.splice(index, 1); // Remove from local data
        renderTAccounts(); // Update the SVG
        socket.emit('deleteAccount', accountId); // Notify server
        console.log(`Account "${deletedAccountTitle}" (ID: ${accountId}) deleted locally and request sent to server.`);
    }
}

// --- Function to clear all T-Accounts and Transactions ---
function clearAllData() {
    boxData = []; // Clear local data
    transactions = []; // Clear local transactions
    renderTAccounts(); // Update the SVG to remove all accounts
    renderTransactionList(); // Update the transaction list
    socket.emit('clearAllAccounts'); // Notify server
    console.log('All T-accounts and transactions cleared locally and request sent to server.');
}

// --- Function to arrange T-Accounts neatly ---
function arrangeTAccounts() {
    if (boxData.length === 0) {
        console.log('No T-accounts to arrange.');
        return;
    }

    const padding = 10; // Padding around accounts and from SVG edges
    const accountsPerRow = Math.max(1, Math.floor((svgWidth - padding) / (tAccountWidth + padding))); // Ensure at least 1 per row

    boxData.forEach((account, index) => {
        const col = index % accountsPerRow;
        const row = Math.floor(index / accountsPerRow);
        account.x = padding + col * (tAccountWidth + padding);
        account.y = padding + row * (tAccountHeight + padding);
    });

    renderTAccounts(); // Update SVG with new positions
    socket.emit('accountsArranged', boxData); // Send all updated account data to server
    console.log('T-accounts arranged locally and new layout sent to server.');
}

// --- Function to show input for renaming T-Account title ---
function showRenameInput(d, groupElement, titleTextElement) {
    // Hide the SVG title text
    d3.select(titleTextElement).style("visibility", "hidden");

    // Get the bounding box of the SVG text element relative to the SVG viewport
    const textScreenBBox = titleTextElement.getBoundingClientRect();

    // Create and position the HTML input field
    const input = d3.select("body").append("input")
        .attr("type", "text")
        .attr("class", "rename-input")
        .style("left", textScreenBBox.left + "px")
        .style("top", textScreenBBox.top + "px")
        .style("width", textScreenBBox.width + "px") // Start with text width
        .style("min-width", "100px") // Ensure a minimum usable width
        .style("height", textScreenBBox.height + "px")
        .property("value", d.title) // Set current title as value
        .on("keypress", function(event) {
            if (event.key === "Enter") {
                event.preventDefault(); // Prevent any default form submission
                this.blur(); // Trigger blur to save and close
            }
        })
        .on("blur", function() {
            const newTitle = this.value.trim();
            d.title = newTitle || "Untitled"; // Use "Untitled" if input is empty

            // Update the SVG title text and make it visible again
            groupElement.select(".t-account-title-text")
                .text(d.title)
                .style("visibility", "visible");

            // Remove the HTML input field
            d3.select(this).remove();

            // Emit the change to the server
            socket.emit('renameAccount', { id: d.id, title: d.title });
        });

    // Automatically focus the input and select its text
    input.node().focus();
    input.node().select();

    // Adjust input width dynamically if text is wider than initial estimate
    const tempSpan = d3.select("body").append("span")
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .style("font-family", "sans-serif")
        .style("visibility", "hidden")
        .style("position", "absolute")
        .text(d.title);
    const textWidth = tempSpan.node().getBoundingClientRect().width;
    tempSpan.remove();
    if (textWidth > textScreenBBox.width) {
        input.style("width", (textWidth + 10) + "px"); // Add a little padding
    }
}

// --- Transaction Modal Logic ---
const transactionModal = document.getElementById('transactionModal');
const closeTransactionModalBtn = document.getElementById('closeTransactionModal');
const addTransactionEntryRowBtn = document.getElementById('addTransactionEntryRow');
const transactionEntriesContainer = document.getElementById('transactionEntriesContainer');
const saveTransactionBtn = document.getElementById('saveTransactionBtn');
const transactionDescriptionInput = document.getElementById('transactionDescription');

// Button to open the modal
const openTransactionModalBtn = document.createElement('button');
openTransactionModalBtn.id = 'openTransactionModalBtn';
openTransactionModalBtn.textContent = 'New Transaction';
document.querySelector('div[style*="margin-bottom: 10px"]').appendChild(openTransactionModalBtn);

openTransactionModalBtn.onclick = function() {
    transactionModal.style.display = "block";
    transactionDescriptionInput.value = "";
    transactionEntriesContainer.innerHTML = ''; // Clear previous entries
    addEntryRowToModal(); // Add one initial entry row
    addEntryRowToModal(); // Add second initial entry row
    updateModalTotals();
}
closeTransactionModalBtn.onclick = function() {
    transactionModal.style.display = "none";
}
window.onclick = function(event) {
    if (event.target == transactionModal) {
        transactionModal.style.display = "none";
    }
}
addTransactionEntryRowBtn.onclick = addEntryRowToModal;

function addEntryRowToModal() {
    const entryDiv = document.createElement('div');
    entryDiv.className = 'transaction-entry';

    const accountSelect = document.createElement('select');
    accountSelect.className = 'transaction-account';
    boxData.forEach(acc => {
        const option = document.createElement('option');
        option.value = acc.id;
        option.textContent = acc.title;
        accountSelect.appendChild(option);
    });

    const typeSelect = document.createElement('select');
    typeSelect.className = 'transaction-type';
    ['Debit', 'Credit'].forEach(type => {
        const option = document.createElement('option');
        option.value = type.toLowerCase();
        option.textContent = type;
        typeSelect.appendChild(option);
    });

    const amountInput = document.createElement('input');
    amountInput.type = 'number';
    amountInput.className = 'transaction-amount';
    amountInput.placeholder = 'Amount';
    amountInput.min = '0.01';
    amountInput.step = '0.01';

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.onclick = function() { entryDiv.remove(); updateModalTotals(); };

    entryDiv.appendChild(accountSelect);
    entryDiv.appendChild(typeSelect);
    entryDiv.appendChild(amountInput);
    entryDiv.appendChild(removeBtn);
    transactionEntriesContainer.appendChild(entryDiv);

    amountInput.oninput = updateModalTotals;
    typeSelect.onchange = updateModalTotals;
}

function updateModalTotals() {
    let totalDebits = 0;
    let totalCredits = 0;
    document.querySelectorAll('.transaction-entry').forEach(row => {
        const type = row.querySelector('.transaction-type').value;
        const amount = parseFloat(row.querySelector('.transaction-amount').value) || 0;
        if (type === 'debit') totalDebits += amount;
        else if (type === 'credit') totalCredits += amount;
    });
    document.getElementById('modalTotalDebits').textContent = totalDebits.toFixed(2);
    document.getElementById('modalTotalCredits').textContent = totalCredits.toFixed(2);
}

saveTransactionBtn.onclick = function() {
    const description = transactionDescriptionInput.value.trim();
    const entries = [];
    let totalDebits = 0;
    let totalCredits = 0;

    document.querySelectorAll('.transaction-entry').forEach(row => {
        const accountId = row.querySelector('.transaction-account').value;
        const type = row.querySelector('.transaction-type').value;
        const amount = parseFloat(row.querySelector('.transaction-amount').value);

        if (!accountId || !type || isNaN(amount) || amount <= 0) {
            // Basic validation for each row
            return; // Skip invalid rows for now
        }
        entries.push({ accountId, type, amount });
        if (type === 'debit') totalDebits += amount;
        else totalCredits += amount;
    });

    if (entries.length < 2) { alert("Please add at least two entries."); return; }
    if (totalDebits !== totalCredits) { alert("Total debits must equal total credits."); return; }
    if (totalDebits === 0) { alert("Transaction amount cannot be zero."); return; }

    const transaction = { id: `txn-${Date.now()}`, description, entries };
    processTransaction(transaction); // Process locally first
    socket.emit('addTransaction', transaction); // Notify server
    transactionModal.style.display = "none";
}

function processTransaction(transaction, emitToServer = true) { // Added emitToServer flag
    transaction.entries.forEach(entry => {
        const account = boxData.find(acc => acc.id === entry.accountId);
        // Ensure the transaction is added to the local list if it's not already there
        // This is important for transactions coming from the server or being processed locally.
        if (!transactions.find(t => t.id === transaction.id)) {
            transactions.push(transaction);
        }
        if (account) {
            const newEntry = { 
                id: `entry-${Date.now()}-${Math.random()}`, // Unique entry ID
                transactionId: transaction.id, // Link entry to transaction
                amount: entry.amount,
                description: transaction.description 
            };
            if (entry.type === 'debit') {
                account.debits.push(newEntry);
                account.totalDebits += entry.amount;
            } else {
                account.credits.push(newEntry);
                account.totalCredits += entry.amount;
            }
        }
    });
    renderTAccounts(); // Re-render to show changes
    renderTransactionList(); // Update the transaction list display
    // Note: The original `processTransaction` didn't have an emitToServer flag.
    // The `saveTransactionBtn.onclick` handles the emit.
    // If `transactionAdded` socket event needs to call this, it should pass `false`.
}

document.getElementById('addAccountBtn').addEventListener('click', addNewTAccount);
document.getElementById('clearAllBtn').addEventListener('click', clearAllData);
document.getElementById('arrangeAccountsBtn').addEventListener('click', arrangeTAccounts);

// --- Transaction List Logic ---
const transactionListUl = document.getElementById('transactionList');

function renderTransactionList() {
    transactionListUl.innerHTML = ''; // Clear existing list
    transactions.forEach(txn => {
        const listItem = document.createElement('li');
        listItem.className = 'transaction-list-item';
        listItem.textContent = txn.description || `Transaction ${txn.id}`;
        listItem.setAttribute('data-transaction-id', txn.id);

        listItem.addEventListener('mouseover', () => {
            highlightTransactionEntries(txn.id, true);
        });
        listItem.addEventListener('mouseout', () => {
            highlightTransactionEntries(txn.id, false);
        });

        transactionListUl.appendChild(listItem);
    });
}

function highlightTransactionEntries(transactionId, shouldHighlight) {
    svg.selectAll(".debit-entry-text, .credit-entry-text")
        .filter(function() {
            // In D3 v7, d3.select(this).attr('data-transaction-id') is fine.
            // For older versions or direct DOM, it's this.dataset.transactionId
            return d3.select(this).attr('data-transaction-id') === transactionId;
        })
        .classed("highlight-entry", shouldHighlight);
}