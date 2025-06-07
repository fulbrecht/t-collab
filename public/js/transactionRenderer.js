import { svg } from './svgService.js';
import * as state from './state.js';
import * as dom from './domElements.js';
import { handleDeleteTransaction, handleEditTransactionDescriptionInPlace } from './transactionActions.js';
import { socket } from './socketService.js';
import { renderTAccounts } from './tAccountRenderer.js';

let draggedTransactionId = null;

function handleDragStart(event) {
    draggedTransactionId = event.target.getAttribute('data-transaction-id');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', draggedTransactionId); // Necessary for Firefox
    event.target.classList.add('dragging-transaction');
}

function handleDragOver(event) {
    event.preventDefault(); // Allow drop
    event.dataTransfer.dropEffect = 'move';
    const targetLi = event.target.closest('.transaction-list-item');
    if (targetLi && targetLi.getAttribute('data-transaction-id') !== draggedTransactionId) {
        // Optional: Add visual cue for drop target
        // targetLi.classList.add('drag-over-target');
    }
}

function handleDrop(event) {
    event.preventDefault();
    const targetLi = event.target.closest('.transaction-list-item');
    if (!targetLi || !draggedTransactionId) return;

    const targetTransactionId = targetLi.getAttribute('data-transaction-id');
    if (targetTransactionId === draggedTransactionId) return;

    let transactions = [...state.getTransactions()];
    const draggedItemIndex = transactions.findIndex(txn => txn.id === draggedTransactionId);
    const targetItemIndex = transactions.findIndex(txn => txn.id === targetTransactionId);

    if (draggedItemIndex === -1 || targetItemIndex === -1) return;

    const [draggedItem] = transactions.splice(draggedItemIndex, 1);
    transactions.splice(targetItemIndex, 0, draggedItem);

    state.setTransactions(transactions); // Update local state immediately
    socket.emit('reorderTransactions', transactions.map(txn => txn.id)); // Send new order of IDs to server
    renderTransactionList(); // Re-render with new order and numbering
    renderTAccounts(); // Re-render T-accounts as transaction indices change y-positions
}

function handleDragEnd(event) {
    event.target.classList.remove('dragging-transaction');
    draggedTransactionId = null;
    // Optional: Remove any 'drag-over-target' classes
}

export function renderTransactionList() {
    dom.transactionListUl.innerHTML = '';
    const transactions = state.getTransactions(); // Get all transactions from local state

    transactions.forEach((txn, index) => {
        const listItem = document.createElement('li');
        listItem.className = 'transaction-list-item';
        listItem.setAttribute('data-transaction-id', txn.id);
        listItem.draggable = true;
        listItem.addEventListener('dragstart', handleDragStart);
        listItem.addEventListener('dragover', handleDragOver);
        listItem.addEventListener('drop', handleDrop);
        listItem.addEventListener('dragend', handleDragEnd);

        const dragHandle = document.createElement('span');
        dragHandle.className = 'drag-handle';
        dragHandle.innerHTML = '&#x2630;'; // Hamburger icon or similar
        listItem.appendChild(dragHandle);

        // Transaction Number
        const numberSpan = document.createElement('span');
        numberSpan.className = 'transaction-number';
        numberSpan.textContent = `${index + 1}.`;
        listItem.appendChild(numberSpan);

        // Active toggle switch (checkbox)
        const activeToggle = document.createElement('input');
        activeToggle.type = 'checkbox';
        activeToggle.className = 'transaction-active-toggle';
        activeToggle.checked = txn.isActive === undefined ? true : txn.isActive; // Default to true if isActive is not set
        activeToggle.title = activeToggle.checked ? "Deactivate transaction (temporarily remove from T-accounts)" : "Activate transaction (add back to T-accounts)";
        activeToggle.addEventListener('change', () => {
            const isActive = activeToggle.checked;
            socket.emit('toggleTransactionActivity', { transactionId: txn.id, isActive });
            activeToggle.title = isActive ? "Deactivate transaction" : "Activate transaction";
        });
        listItem.appendChild(activeToggle);

        const descriptionSpan = document.createElement('span');
        descriptionSpan.className = 'transaction-description';
        descriptionSpan.textContent = txn.description || `Transaction ${txn.id}`;
        listItem.appendChild(descriptionSpan);

        listItem.addEventListener('mouseover', () => {
            socket.emit('startHighlightTransaction', { transactionId: txn.id });
            highlightTransactionEntries(txn.id, true, 'local');
        });
        listItem.addEventListener('mouseout', () => {
            socket.emit('endHighlightTransaction', { transactionId: txn.id });
            highlightTransactionEntries(txn.id, false, 'local');
        });
        listItem.addEventListener('dblclick', function(event) {
            event.stopPropagation();
            // Ensure dblclick only triggers on description, not checkbox
            if (event.target.closest('.transaction-description')) {
                handleEditTransactionDescriptionInPlace(txn, descriptionSpan);
            }
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'X';
        deleteBtn.className = 'transaction-delete-btn';
        deleteBtn.onclick = (event) => { event.stopPropagation(); handleDeleteTransaction(txn.id, txn.description); };
        listItem.appendChild(deleteBtn);

        // Apply visual style if inactive
        listItem.classList.toggle('inactive-transaction', !activeToggle.checked);

        dom.transactionListUl.appendChild(listItem);
    });
}

export function highlightTransactionEntries(transactionId, shouldHighlight, highlightType = 'local') {
    const entrySelector = ".debit-entry-text, .credit-entry-text";
    const listItemSelector = '.transaction-list-item';
    const localEntryClass = 'local-highlight-entry', remoteEntryClass = 'remote-highlight-entry';
    const localListItemClass = 'local-highlight-list-item', remoteListItemClass = 'remote-highlight-list-item';
    const entryClassToApply = highlightType === 'local' ? localEntryClass : remoteEntryClass;
    const listItemClassToApply = highlightType === 'local' ? localListItemClass : remoteListItemClass;

    if (!shouldHighlight) {
        svg.selectAll(entrySelector).classed(localEntryClass, false).classed(remoteEntryClass, false);
        d3.select(dom.transactionListUl).selectAll(listItemSelector).classed(localListItemClass, false).classed(remoteListItemClass, false);
    }
    svg.selectAll(entrySelector).filter(function() { return d3.select(this).attr('data-transaction-id') === transactionId; }).classed(entryClassToApply, shouldHighlight);
    d3.select(dom.transactionListUl).selectAll(listItemSelector).filter(function() { return this.getAttribute('data-transaction-id') === transactionId; }).classed(listItemClassToApply, shouldHighlight);
}