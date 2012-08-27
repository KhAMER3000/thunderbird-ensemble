// Nothing in this file is going to be used in the final product - it's
// just the logic behind a crappy little UI tool for testing things when
// I don't feel like automating.
//
// So there's bad code in here. And that's expected. Please ignore.

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;
const kPersonalAddressbookURI = "moz-abmdbdirectory://abook.mab";

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource:///modules/mailServices.js");
Cu.import("resource://ensemble/Ensemble.jsm");
Cu.import("resource://ensemble/Contact.jsm");
Cu.import("resource://ensemble/SQLiteContactStore.jsm");

let DebugTab = {

  init: function DebugTab_init() {
    document.getElementById('insertFakeContacts')
            .addEventListener('click', this.insertFakeContacts.bind(this));
    document.getElementById('createDb')
            .addEventListener('click', this._createDb.bind(this));
    document.getElementById('importOldTB')
            .addEventListener('click', this._importOldTB.bind(this));

    Ensemble.init(SQLiteContactStore, function(aResult) {
      alert("aResult is: " + aResult);
    });
  },

  uninit: function DebugTab_uninit() {
    Ensemble.uninit(function(aResult) {});
  },

  insertFakeContacts: function DebugTab_insertFakeContacts() {
    // Load up the fakecontacts JSON.
    let req = Cc['@mozilla.org/xmlextras/xmlhttprequest;1']
                .createInstance(Ci.nsIXMLHttpRequest);

    req.overrideMimeType('application/json');
    req.open('GET',
      'resource://ensemble-test-data/fakecontacts/fakecontacts.json',
      true);

    req.onreadystatechange = function() {
      if (req.readyState === 4 && (req.status === 200 ||
                                   req.status === 0)) {
        let contacts = JSON.parse(req.responseText);
        if (contacts) {
          this._insertContacts(contacts);
        }
      }
    }.bind(this);

    req.send(null);
  },

  _insertContacts: function DebugTab_insertContacts(aContacts) {
    // Synchronously (bleh) jam ~500 contacts into the old TB address book.
    let pab = MailServices.ab.getDirectory(kPersonalAddressbookURI);

    function setFirstIfAvailable(aCard, aProp, aVal) {
      if (aVal && aVal[0])
        aCard.setProperty(aProp, aVal[0]);
    }

    for each (let [, contact] in Iterator(aContacts)) {
      let card = Cc["@mozilla.org/addressbook/cardproperty;1"]
                   .createInstance(Ci.nsIAbCard);
      setFirstIfAvailable(card, "DisplayName", contact.name);
      setFirstIfAvailable(card, "PrimaryEmail", contact.email);
      setFirstIfAvailable(card, "FirstName", contact.givenName);
      setFirstIfAvailable(card, "LastName", contact.familyName);
      setFirstIfAvailable(card, "JobTitle", contact.jobTitle);
      setFirstIfAvailable(card, "Company", contact.org);
      setFirstIfAvailable(card, "NickName", contact.additionalName);
      if (contact.tel[0] && contact.tel[0].number)
        card.setProperty("HomePhone", contact.tel[0].number);

      if (contact.adr[0]) {
        let adr = contact.adr[0];
        if (adr.countryName)
          card.setProperty("HomeCountry", adr.countryName);
        if (adr.locality)
          card.setProperty("HomeCity", adr.locality);
        if (adr.postalCode)
          card.setProperty("HomeZipCode", adr.postalCode);
        if (adr.region)
          card.setProperty("HomeState", adr.region);
        if (adr.streetAddress)
          card.setProperty("HomeAddress", adr.streetAddress);
      }

      if (contact.bday) {
        let d = new Date(contact.bday);
        card.setProperty("BirthDay", d.getDate());
        card.setProperty("BirthMonth", d.getMonth());
        card.setProperty("BirthYear", d.getFullYear());
      }

      pab.addCard(card);
    }
  },

  _createDb: function DebugTab_createDb() {
    SQLiteContactStore.init(function(aResult) {
      alert("Done! Result was: " + aResult);
      if (aResult != Cr.NS_OK) {
        alert(aResult.code);
      }
    });

    Services.obs.addObserver(this, "profile-before-change", false);
  },

  _importOldTB: function DebugTab_importOldTB() {
    Cu.import("resource://ensemble/connectors/TBMorkConnector.jsm");
    let mork = new TBMorkConnector();
    let result = mork.getAllRecords(function(aRecords, aTags) {

      dump("\n\nDONE!\n\n");

      for each (let [, record] in Iterator(aRecords)) {
        let contact = new Contact(record.fields, record.meta);
/*
        Ensemble.saveContact(contact, function(aSaved) {
          dump("\n\nContact saved!\n\n");
        });*/
      }

    });
  },

  observe: function(aSubject, aTopic, aData) {
    if (aTopic == "profile-before-change")
      SQLiteContactStore.uninit();
  }
};

window.addEventListener('load', function() {
  DebugTab.init();
});

window.addEventListener('unload', function() {
  DebugTab.uninit();
});
