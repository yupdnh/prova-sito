const CLIENT_ID = "56253726954-09m34mc6cck2pq2k4cr2k98l2et66l8d.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive.file";
const DEVELOPER_KEY = "AIzaSyD7-9UPOWV5B1Z49oDHcCHkERlyxaV61e4"; // API Key progetto Google Cloud

let tokenClient;
let importTokenClient;
let pickerApiLoaded = false;

// --- GIS init ---
function gisInit() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: async (tokenResponse) => {
      if (tokenResponse.error) {
        console.error("Errore token:", tokenResponse);
        alert("Errore ottenendo il token OAuth");
        return;
      }
      console.log("Token ottenuto:", tokenResponse.access_token);
      await uploadXMLToDrive(tokenResponse.access_token);
    }
  });
}

// --- Upload XML su Drive ---
async function uploadXMLToDrive(accessToken) {
  try {
    if (rows.length === 0) { alert("Nessun dato da caricare"); return; }

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

    const file = new Blob([xmlContent], { type: "application/xml" });
    const metadata = { name: "trades_uploaded.xml", mimeType: "application/xml" };

    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.append("file", file);

    const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST",
      headers: { Authorization: "Bearer " + accessToken },
      body: form
    });

    const result = await res.json();
    console.log("File caricato:", result);
    alert("✅ File caricato su Drive con ID: " + result.id);

  } catch (err) {
    console.error("Errore upload:", err);
    alert("❌ Errore durante il caricamento su Drive");
  }
}

// --- Pulsante Upload ---
document.getElementById("uploadDriveBtn").addEventListener("click", () => {
  if (!tokenClient) gisInit();
  tokenClient.requestAccessToken({ prompt: 'consent' });
});

// --- Import XML da Drive ---
function initImportTokenClient() {
  importTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: async (tokenResponse) => {
      if (tokenResponse.error) { alert("Errore ottenendo token"); return; }
      openDrivePicker(tokenResponse.access_token);
    }
  });
}

document.getElementById("importDriveBtn").addEventListener("click", () => {
  if(!importTokenClient) initImportTokenClient();
  importTokenClient.requestAccessToken({ prompt: 'consent' });
});

// --- Picker API ---
function loadPickerApi() {
  gapi.load('picker', { callback: () => { pickerApiLoaded = true; }});
}

function openDrivePicker(accessToken) {
  if (!pickerApiLoaded) loadPickerApi();

  const view = new google.picker.DocsView(google.picker.ViewId.DOCS)
      .setMimeTypes("application/xml")
      .setMode(google.picker.DocsViewMode.LIST);

  const picker = new google.picker.PickerBuilder()
      .enableFeature(google.picker.Feature.NAV_HIDDEN)
      .enableFeature(google.picker.Feature.MULTISELECT_DISABLED)
      .setOAuthToken(accessToken)
      .setDeveloperKey(DEVELOPER_KEY)
      .addView(view)
      .setCallback(pickerCallback)
      .build();
  picker.setVisible(true);
}

function pickerCallback(data) {
  if (data.action === google.picker.Action.PICKED) {
    const fileId = data.docs[0].id;
    fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: "Bearer " + importTokenClient.access_token }
    })
    .then(res => res.text())
    .then(content => {
      parseXMLContent(content);
      alert("✅ Import da Drive completato!");
    });
  }
}

// --- Inizializza GIS al caricamento della pagina ---
window.onload = () => {
  gisInit();
};
