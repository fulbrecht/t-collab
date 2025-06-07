import { svg } from './svgService.js';
import * as state from './state.js';
import { tAccountWidth, tAccountHeight, headerHeight, totalsHeight, columnLabelYOffset } from './config.js';
import { dragBehavior } from './dragController.js';
import { showRenameInput, deleteAccount } from './tAccountActions.js'; // Forward declaration, will be defined
import { highlightTransactionEntries } from './transactionRenderer.js'; // Import for highlighting
import { socket } from './socketService.js'; // Import for emitting highlight events

export function buildTAccountStructure(selection) {
    selection.append("rect")
        .attr("class", "t-account-box")
        .attr("width", tAccountWidth)
        .attr("height", tAccountHeight);

    selection.append("text")
        .attr("class", "t-account-title-text")
        .attr("x", tAccountWidth / 2)
        .attr("y", headerHeight / 2)
        .text(d => d.title)
        .style("pointer-events", "auto")
        .on("dblclick", function(event, d) {
            event.stopPropagation();
            const groupElement = d3.select(this.parentNode);
            showRenameInput(d, groupElement, this);
        });

    selection.append("line")
        .attr("class", "t-account-line")
        .attr("x1", 0).attr("y1", headerHeight)
        .attr("x2", tAccountWidth).attr("y2", headerHeight);

    selection.append("line")
        .attr("class", "t-account-line")
        .attr("x1", tAccountWidth / 2).attr("y1", headerHeight)
        .attr("x2", tAccountWidth / 2).attr("y2", tAccountHeight);

    selection.append("text")
        .attr("class", "delete-account-btn")
        .attr("x", tAccountWidth - 10)
        .attr("y", 15)
        .style("cursor", "pointer")
        .style("font-size", "18px")
        .style("fill", "#E74C3C")
        .style("pointer-events", "auto")
        .text("X")
        .on("click", function(event, d) {
            event.stopPropagation();
            if (confirm(`Delete account "${d.title}"? This will also delete all related transactions.`)) {
                deleteAccount(d.id);
            }
        });

    selection.append("text")
        .attr("class", "t-account-column-label")
        .attr("x", tAccountWidth / 4)
        .attr("y", columnLabelYOffset)
        .text("Debits");

    selection.append("text")
        .attr("class", "t-account-column-label")
        .attr("x", (tAccountWidth / 4) * 3)
        .attr("y", columnLabelYOffset)
        .text("Credits");

    selection.append("line")
        .attr("class", "t-account-line")
        .attr("x1", 0).attr("y1", tAccountHeight - totalsHeight)
        .attr("x2", tAccountWidth).attr("y2", tAccountHeight - totalsHeight);

    selection.append("text")
        .attr("class", "debit-total t-account-total-text")
        .attr("x", tAccountWidth / 4)
        .attr("y", tAccountHeight - totalsHeight / 2)
        .text("");

    selection.append("text")
        .attr("class", "credit-total t-account-total-text")
        .attr("x", (tAccountWidth / 4) * 3)
        .attr("y", tAccountHeight - totalsHeight / 2)
        .text("");
}

export function renderTAccounts() {
    const groups = svg.selectAll(".draggable-group")
        .data(state.getAccounts(), d => d.id);
    
    // Get all transactions once to efficiently find indices later
    const allTransactions = state.getTransactions();
    const entryRowHeight = 15; // Height of each entry row
    const entryStartY = columnLabelYOffset + 20; // Starting Y position for the first entry

    groups.exit().remove();

    const newGroups = groups.enter()
        .append("g")
        .attr("class", "draggable-group")
        .attr("transform", d => `translate(${d.x}, ${d.y})`)
        .call(dragBehavior);

    buildTAccountStructure(newGroups);

    const allGroups = groups.merge(newGroups);
    allGroups.each(function(d) {
        const group = d3.select(this);
        const netTotal = d.totalDebits - d.totalCredits;
        if(netTotal > 0){
            group.select(".debit-total").text(`${netTotal.toFixed(2)}`);
            group.select(".credit-total").text("");
        } else if(netTotal < 0){
            group.select(".credit-total").text(`${(-netTotal).toFixed(2)}`);
            group.select(".debit-total").text("");
        } else {
            group.select(".debit-total").text("0.00");
            group.select(".credit-total").text("0.00");
        
        }
        // group.select(".debit-total").text(d.totalDebits.toFixed(2));
        // group.select(".credit-total").text(d.totalCredits.toFixed(2));
        

        // --- DEBIT ENTRIES ---
        const debitEntryGroups = group.selectAll(".debit-entry-group")
            .data(d.debits, entry => entry.id);

        debitEntryGroups.exit().remove();

        const debitEntryGroupsEnter = debitEntryGroups.enter().append("g")
            .attr("class", "debit-entry-group")
            .attr("transform", (entry) => {
                const sourceTransaction = allTransactions.find(t => t.id === entry.transactionId);
                const transactionListIndex = sourceTransaction ? allTransactions.indexOf(sourceTransaction) : -1;
                return `translate(0, ${entryStartY + (transactionListIndex * entryRowHeight)})`;
            });

        // Debit Entry Index
        debitEntryGroupsEnter.append("text")
            .attr("class", "t-account-entry-index debit-entry-index") // Keep specific class if needed for styling/selection, common class for shared styles
            .attr("x", 10) // X position for debit index
            .attr("text-anchor", "start");

        // Debit Entry Amount
        debitEntryGroupsEnter.append("text")
            .attr("class", "debit-entry-text")
            .attr("x", tAccountWidth / 4)
            .attr("text-anchor", "middle");

        const allDebitEntryGroups = debitEntryGroups.merge(debitEntryGroupsEnter);

        // Update transform for existing groups as well if their underlying transaction's index changes (though less likely)
        allDebitEntryGroups.attr("transform", (entry) => {
            const sourceTransaction = allTransactions.find(t => t.id === entry.transactionId);
            const transactionListIndex = sourceTransaction ? allTransactions.indexOf(sourceTransaction) : -1;
            return `translate(0, ${entryStartY + (transactionListIndex * entryRowHeight)})`;
        });
        allDebitEntryGroups.select(".debit-entry-index")
            .text(entry => {
                const sourceTransaction = allTransactions.find(t => t.id === entry.transactionId);
                const transactionIndex = sourceTransaction ? allTransactions.indexOf(sourceTransaction) : -1;
                return transactionIndex !== -1 ? `${transactionIndex + 1}.` : "";
            })
            .attr("data-transaction-id", entry => entry.transactionId);

        allDebitEntryGroups.select(".debit-entry-text")
            .text(entry => entry.amount.toFixed(2))
            .attr("data-transaction-id", entry => entry.transactionId)
            .style("pointer-events", "auto") // Apply to merged selection
            .style("cursor", "default")      // Apply to merged selection
            .on('mouseover', function(event, entry) {
                socket.emit('startHighlightTransaction', { transactionId: entry.transactionId });
                highlightTransactionEntries(entry.transactionId, true, 'local');
            })
            .on('mouseout', function(event, entry) {
                socket.emit('endHighlightTransaction', { transactionId: entry.transactionId });
                highlightTransactionEntries(entry.transactionId, false, 'local');
            });
            
        // --- CREDIT ENTRIES ---
        const creditEntryGroups = group.selectAll(".credit-entry-group")
            .data(d.credits, entry => entry.id);

        creditEntryGroups.exit().remove();

        const creditEntryGroupsEnter = creditEntryGroups.enter().append("g")
            .attr("class", "credit-entry-group")
            .attr("transform", (entry) => {
                const sourceTransaction = allTransactions.find(t => t.id === entry.transactionId);
                const transactionListIndex = sourceTransaction ? allTransactions.indexOf(sourceTransaction) : -1;
                return `translate(0, ${entryStartY + (transactionListIndex * entryRowHeight)})`;
            });

        // Credit Entry Index
        creditEntryGroupsEnter.append("text")
            .attr("class", "t-account-entry-index credit-entry-index") // Keep specific class, common class for shared styles
            .attr("x", 10) // X position for credit index, now aligned to far left
            .attr("text-anchor", "start");
        
        // Credit Entry Amount
        creditEntryGroupsEnter.append("text")
            .attr("class", "credit-entry-text")
            .attr("x", (tAccountWidth / 4) * 3)
            .attr("text-anchor", "middle");

        const allCreditEntryGroups = creditEntryGroups.merge(creditEntryGroupsEnter);

        // Update transform for existing groups
        allCreditEntryGroups.attr("transform", (entry) => {
            const sourceTransaction = allTransactions.find(t => t.id === entry.transactionId);
            const transactionListIndex = sourceTransaction ? allTransactions.indexOf(sourceTransaction) : -1;
            return `translate(0, ${entryStartY + (transactionListIndex * entryRowHeight)})`;
        });
        allCreditEntryGroups.select(".credit-entry-index")
            .text(entry => {
                const sourceTransaction = allTransactions.find(t => t.id === entry.transactionId);
                const transactionIndex = sourceTransaction ? allTransactions.indexOf(sourceTransaction) : -1;
                return transactionIndex !== -1 ? `${transactionIndex + 1}.` : "";
            })
            .attr("data-transaction-id", entry => entry.transactionId);

        allCreditEntryGroups.select(".credit-entry-text")
            .text(entry => entry.amount.toFixed(2))
            .attr("data-transaction-id", entry => entry.transactionId)
            .style("pointer-events", "auto") // Apply to merged selection
            .style("cursor", "default")      // Apply to merged selection
            .on('mouseover', function(event, entry) {
                socket.emit('startHighlightTransaction', { transactionId: entry.transactionId });
                highlightTransactionEntries(entry.transactionId, true, 'local');
            })
            .on('mouseout', function(event, entry) {
                socket.emit('endHighlightTransaction', { transactionId: entry.transactionId });
                highlightTransactionEntries(entry.transactionId, false, 'local');
            });
    });
    groups.attr("transform", d => `translate(${d.x}, ${d.y})`);
}