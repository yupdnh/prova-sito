
    let table;
    let rows = [];
    let editingIndex = null;
    let currentSymbol = '';

function parseXMLContent(content) {
  console.log("📄 Anteprima XML ricevuto:", content.substring(0, 300)); // debug

  const parser = new DOMParser();
  const xml = parser.parseFromString(content, "application/xml");

  // Verifica se c'è un errore di parsing
  const parserError = xml.querySelector("parsererror");
  if (parserError) {
    console.error("❌ Errore nel parsing XML:", parserError.textContent);
    alert("Errore nel parsing XML:\n" + parserError.textContent);
    return;
  }

  rows = [];
  xml.querySelectorAll("stock").forEach(stock => {
    const symbol = stock.getAttribute("symbol") || "";

    stock.querySelectorAll("transaction").forEach(tx => {
      let dateVal = tx.querySelector("date")?.textContent?.trim() || "";
      // retrocompatibilità: se manca ora → aggiungo T00:00
      if (dateVal && dateVal.length === 10) dateVal += "T00:00";

      // parsing sicuro dei numeri
      const safeParse = (el) => {
        const val = el?.textContent?.trim();
        return val && !isNaN(val) ? parseFloat(val) : 0;
      };

      rows.push([
        symbol,
        tx.getAttribute("type") || "",
        safeParse(tx.querySelector("shares")),
        safeParse(tx.querySelector("price")),
        safeParse(tx.querySelector("fee")),
        safeParse(tx.querySelector("total")),
        dateVal,
        tx.querySelector("notes")?.textContent?.trim() || ""
      ]);
    });
  });

  if (table) {
    table.clear().rows.add(rows).draw();
  } else {
    table = $('#tradesTable').DataTable({
      data: rows,
      columns: [
        { title: "Titolo" },
        { title: "Tipo" },
        { 
          title: "Azioni",
          render: data => `<div title="${data.toFixed(6)}">${data.toFixed(6)}</div>`
        },
        { 
          title: "Prezzo",
          render: data => `<div title="${data.toFixed(6)}">${data.toFixed(6)}</div>`
        },
        { 
          title: "Fee",
          render: data => `<div title="${data.toFixed(6)}">${data.toFixed(6)}</div>`
        },
        { 
          title: "Totale",
          render: data => `<div title="${data.toFixed(6)}">${data.toFixed(6)}</div>`
        },
        { 
          title: "Data",
          render: data => {
            if (!data) return "";
            const dt = new Date(data);
            return isNaN(dt) ? data : dt.toLocaleString();
          }
        },
        { 
          title: "Note",
          render: data => data ? `<div class="notes-cell" title="${data}">${data}</div>` : ""
        }
      ],
      destroy: true,
      responsive: true,
      order: [[6, "desc"]]
    });
  }

  updateSummary();
  updateSymbolsList();
  $('#panelSummary').hide();
}


    function updateSymbolsList() {
      const symbols = [...new Set(rows.map(r => r[0]))].sort();
      const datalist = document.getElementById("symbolsList");
      datalist.innerHTML = "";
      symbols.forEach(s => {
        const option = document.createElement("option");
        option.value = s;
        datalist.appendChild(option);
      });
    }

	function exportXML() {
	  let xmlContent = `<portfolio>\n`;
	  const grouped = {};

	  rows.forEach((row, i) => {
		const [symbol, type, shares, price, fee, total, date, notes] = row;
		if (!grouped[symbol]) grouped[symbol] = [];
		grouped[symbol].push({ id: i + 1, type, shares, price, fee, total, date, notes });
	  });

	  for (let symbol in grouped) {
		xmlContent += `  <stock symbol="${symbol}" name="${symbol}">\n`;
		grouped[symbol].forEach(tx => {
		  xmlContent += `    <transaction id="${tx.id}" type="${tx.type}">\n`;
		  xmlContent += `      <shares>${tx.shares}</shares>\n`;
		  xmlContent += `      <price>${tx.price}</price>\n`;
		  xmlContent += `      <fee>${tx.fee}</fee>\n`;
		  xmlContent += `      <total>${tx.total}</total>\n`;
		  xmlContent += `      <date>${tx.date}</date>\n`;
		  if (tx.notes) xmlContent += `      <notes><![CDATA[${tx.notes}]]></notes>\n`;
		  xmlContent += `    </transaction>\n`;
		});
		xmlContent += `  </stock>\n`;
	  }

	  xmlContent += `</portfolio>`;
	  const blob = new Blob([xmlContent], { type: "application/xml" });
	  const a = document.createElement("a");
	  a.href = URL.createObjectURL(blob);
	  a.download = "trades_updated.xml";
	  a.click();
	}


    function openModal(edit=false,index=null){
      document.getElementById("modal").style.display="flex";
      document.getElementById("modalTitle").textContent = edit?"Modifica Operazione":"Nuova Operazione";
      editingIndex=index;
      if(edit && index!==null){
        const row=rows[index];
        document.getElementById("symbol").value=row[0];
        document.getElementById("type").value=row[1];
        document.getElementById("shares").value=row[2];
        document.getElementById("price").value=row[3];
        document.getElementById("fee").value=row[4];
        document.getElementById("total").value=row[5];
        document.getElementById("date").value=row[6];
        document.getElementById("notes").value=row[7] || "";
      } else {
        document.querySelectorAll(".modal-content input, .modal-content textarea").forEach(el=>el.value="");
        document.getElementById("type").value="BUY";
      }
      document.getElementById("symbol").focus();
      updateTotal();
    }

    function closeModal(){ document.getElementById("modal").style.display="none"; }

    function updateTotal(){
      const type=document.getElementById("type").value;
      const shares=parseFloat(document.getElementById("shares").value)||0;
      const price=parseFloat(document.getElementById("price").value)||0;
      const fee=parseFloat(document.getElementById("fee").value)||0;
      const total=type==="SELL"?(shares*price-fee).toFixed(2):(shares*price+fee).toFixed(2);
      document.getElementById("total").value=total;
    }

    function updateSummary(){
      let totalBuy=0,totalSell=0;
      rows.forEach(row=>{
        const type=row[1], total=parseFloat(row[5])||0;
        if(type==="BUY") totalBuy+=total;
        if(type==="SELL") totalSell+=total;
      });
      const balance=totalSell-totalBuy;
      document.getElementById("totalBuy").textContent=totalBuy.toFixed(2);
      document.getElementById("totalSell").textContent=totalSell.toFixed(2);
      const balanceEl=document.getElementById("balance");
      balanceEl.textContent=balance.toFixed(2);
      balanceEl.style.color=balance<0?"red":"green";
    }

function mapSymbolToMarket(symbol, market) {
  if (!symbol) return symbol;
  switch (market) {
    case "MILAN": return symbol.endsWith(".MI") ? symbol : `${symbol}.MI`;
    case "XETRA": return symbol.endsWith(".DE") ? symbol : `${symbol}.DE`;
    case "LSE":   return symbol.endsWith(".L")  ? symbol : `${symbol}.L`;
    default:      return symbol; // NASDAQ, NYSE ecc.
  }
}

// Funzione per ottenere il prezzo di mercato (simulato)
// Funzione per ottenere il prezzo di mercato (compatibile con GitHub Pages)
async function fetchMarketPrice(symbol, market) {
  $('#priceLoading').show();
  $('#priceTimestamp').text('');

  try {
    // Aggiunge il suffisso corretto in base al mercato scelto
    symbol = mapSymbolToMarket(symbol, market);

    //  Proxy CORS pubblico che inoltra la richiesta a Yahoo Finance
    const url = `https://corsproxy.io/?https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;

    if (!price) throw new Error("Prezzo non disponibile per questo simbolo.");

    // Aggiorna UI
    $('#currentPrice').val(price.toFixed(2));
    $('#priceTimestamp').text(new Date().toLocaleTimeString());
    updateProjection();

  } catch (error) {
    console.error("❌ Errore nel recupero del prezzo:", error);
    $('#priceTimestamp')
      .text("⚠️ Prezzo non disponibile")
      .css('color', 'red');
    alert("Impossibile ottenere il prezzo di mercato reale. Verifica il simbolo o la connessione.");
  } finally {
    $('#priceLoading').hide();
  }
}




	function updateProjection() {
	  const price = parseFloat($('#currentPrice').val()) || 0;
	  const deltaShares = parseFloat($('#sumDeltaShares').text()) || 0;
	  const deltaMoney = parseFloat($('#sumDeltaMoney').text().replace(' €', '')) || 0;
	  const avgNet = parseFloat($('#sumAvgNet').text().replace(' €', '')) || 0;

	  const value = (deltaShares * price).toFixed(2);
	  const gain = (deltaShares * price - deltaShares * avgNet).toFixed(2); // Capital Gain basato su Prezzo Medio Netto
	  const percent = deltaShares > 0 ? ((price - avgNet) / avgNet * 100).toFixed(2) : 0; // % Variazione basata su Prezzo Medio Netto

	  $('#theoreticalValue').text(value + ' €');
	  
	  $('#capitalGain').text(gain + ' €');
	  $('#gainArrow').html(gain > 0 ? '⬆️' : gain < 0 ? '⬇️' : '');
	  $('#capitalGain').css('color', gain > 0 ? 'green' : gain < 0 ? 'red' : 'black');

	  $('#percentChange').text(percent + ' %').css('color', percent > 0 ? 'green' : percent < 0 ? 'red' : 'black');
	}


function updateTitleSummary(selectedRow=null) {
  if(!table || !selectedRow) { 
    $('#panelSummary').hide();
    return; 
  }

  currentSymbol = selectedRow[0];
  const dataForSymbol = rows.filter(r => r[0] === currentSymbol);

  let totalBuyShares=0, moneyOut=0, totalSellShares=0, moneyIn=0;

  dataForSymbol.forEach(r=>{
    const type=r[1], shares=parseFloat(r[2]), total=parseFloat(r[5]);
    if(type==='BUY'){ totalBuyShares+=shares; moneyOut+=total; }
    else if(type==='SELL'){ totalSellShares+=shares; moneyIn+=total; }
  });

  const deltaShares = totalBuyShares - totalSellShares; // azioni attuali
  const deltaMoney = moneyOut - moneyIn;               // saldo investito

  const avgBuy = totalBuyShares>0 ? (moneyOut/totalBuyShares).toFixed(2) : 0; // PMC
  const avgNet = deltaShares>0 ? (deltaMoney/deltaShares).toFixed(2) : 0;    // Prezzo medio netto

  // Aggiorna valori riepilogo
  $('#sumSymbol').text(currentSymbol);
  $('#sumBuy').text(`${totalBuyShares.toFixed(6)} azioni, Investimento: ${moneyOut.toFixed(2)} €`);
  $('#sumSell').text(`${totalSellShares.toFixed(6)} azioni, Incasso: ${moneyIn.toFixed(2)} €`);
  $('#sumDeltaShares').text(deltaShares.toFixed(6));
  $('#sumDeltaMoney').text(deltaMoney.toFixed(2)+' €');
  $('#sumAvgBuy').text(avgBuy+' €');
  $('#sumAvgNet').text(avgNet+' €');

  // Mostra pannello
  $('#panelSummary').show();

  // Reset proiezione
  $('#currentPrice').val('');
  $('#theoreticalValue').text('0.00 €').css('color','black');
  $('#capitalGain').text('0.00 €');
  $('#gainArrow').html('');
  $('#percentChange').text('0.00 %').css('color','black');
  $('#priceTimestamp').text('');

  // Aggiornamento in tempo reale proiezione
  $('#currentPrice').off('input').on('input', updateProjection);
}


    $(document).ready(function(){
      $("#importBtn").on("click",()=>$("#fileInput").click());
      $("#fileInput").on("change",(event)=>{
        const file=event.target.files[0]; if(!file) return;
        const reader=new FileReader();
        reader.onload=(e)=>parseXMLContent(e.target.result);
        reader.readAsText(file,"UTF-8");
      });

      $("#addBtn").on("click",()=>openModal(false));
      $("#deleteBtn").on("click",()=>{
        const selected=table.row('.selected'); 
        if(!selected.data()){alert("Seleziona una riga da eliminare!"); return;}
        if(!confirm("Sei sicuro di voler eliminare questa operazione?")) return;
        rows.splice(selected.index(),1); selected.remove().draw(false); updateSummary(); updateSymbolsList(); $('#panelSummary').hide();
      });
      $("#exportBtn").on("click",()=>exportXML());

	// Salvataggio operazione con datetime-local
	$("#saveBtn").on("click", () => {
	  const symbol = $("#symbol").val().trim();
	  const type = $("#type").val();
	  const shares = parseFloat($("#shares").val());
	  const price = parseFloat($("#price").val());
	  const fee = parseFloat($("#fee").val()) || 0;
	  const total = type === "SELL" ? (shares * price - fee) : (shares * price + fee);

	  let date = $("#date").val();
	  if(date.length === 10) date += "T00:00"; // retrocompatibilità vecchie date

	  const notes = $("#notes").val();

	  if(!symbol || !type || !shares || !price || !date) { alert("Compila tutti i campi obbligatori!"); return; }
	  if(shares <= 0 || price <= 0 || fee < 0) { alert("Valori numerici non validi!"); return; }

	  const newRow = [symbol, type, shares, price, fee, total, date, notes];

	  if(editingIndex !== null) {
		rows[editingIndex] = newRow;
		table.row(editingIndex).data(newRow).draw(false);
	  } else {
		rows.push(newRow);
		table.row.add(newRow).draw(false);
	  }

	  updateSummary();
	  updateSymbolsList();
	  updateTitleSummary(newRow);
	  closeModal();
	});

      $("#cancelBtn").on("click",closeModal);
      $("#shares,#price,#fee,#type").on("input change",updateTotal);

      // Selezione e riepilogo
      $('#tradesTable tbody').on('click','tr',function(){
        $(this).toggleClass('selected').siblings().removeClass('selected');
        const selectedData = table.row(this).data();
        
        if (selectedData) {
          const symbol = selectedData[0]; // colonna "Titolo"
          // aggiorna campo filtro
          $("#filterSymbol").val(symbol);
          // applica filtro come se lo avessi digitato
          table.column(0).search(symbol).draw();
          // aggiorna riepilogo
          updateTitleSummary(selectedData);
        }
      });


      // Doppio click apre modal di modifica
      $('#tradesTable tbody').on('dblclick','tr',function(){
        const index = table.row(this).index();
        openModal(true,index);
      });

      // Filtri Titolo / Tipo
      $("#filterSymbol").on("input",function(){ table.column(0).search(this.value).draw(); });
      $("#filterType").on("change",function(){ table.column(1).search(this.value).draw(); });

	// Filtro date + ora
	$.fn.dataTable.ext.search.push(function(settings,data){
	  const min = $('#filterDateFrom').val();
	  const max = $('#filterDateTo').val();
	  const dateVal = data[6];
	  if(!dateVal) return true;
	  if(min && dateVal < min) return false;
	  if(max && dateVal > max) return false;
	  return true;
	});
	$('#filterDateFrom,#filterDateTo').on("change",()=>table.draw());

      // Reset filtri
      $("#resetFilters").on("click",function(){
        $("#filterSymbol").val(''); $("#filterType").val('');
        $("#filterDateFrom").val(''); $("#filterDateTo").val('');
        table.search('').columns().search('').draw();
        $('#panelSummary').hide();
      });

      // Ottieni prezzo di mercato
      $("#fetchMarketPrice").on("click",function(){
        if (!currentSymbol) {
          alert("Seleziona prima un titolo dalla tabella");
          return;
        }
        const market = $("#marketSelect").val();
        fetchMarketPrice(currentSymbol, market);
      });

      window.onclick=function(event){ if(event.target==document.getElementById("modal")) closeModal(); };
    });
