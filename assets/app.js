// Le calendrier de l'avent de la romcom
(function () {
  "use strict";

  var ANNEE = 2026;
  // Ordre d'affichage des cases (mélangé, comme un vrai calendrier de l'avent)
  var ORDRE = [7, 18, 3, 22, 11, 1, 15, 9, 24, 5, 13, 20, 2, 17, 10, 6, 23, 12, 4, 19, 14, 8, 21, 16];
  var CLE_STOCKAGE = "romcom-avent-" + ANNEE + "-ouvertes";

  var films = window.FILMS || [];
  var params = new URLSearchParams(location.search);
  // ?apercu : tout ouvrir pour relire. ?date=2026-12-10 : simuler un jour donné.
  var apercu = params.has("apercu");

  function aujourdhuiParis() {
    var forcee = params.get("date");
    if (forcee && /^\d{4}-\d{2}-\d{2}$/.test(forcee)) {
      var p = forcee.split("-").map(Number);
      return { a: p[0], m: p[1], j: p[2] };
    }
    var morceaux = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(new Date());
    var d = {};
    morceaux.forEach(function (x) { d[x.type] = Number(x.value); });
    return { a: d.year, m: d.month, j: d.day };
  }

  var auj = aujourdhuiParis();
  // Nombre de cases débloquées (0 avant le 1er décembre, 24 après Noël)
  var debloquees = apercu ? 24
    : auj.a > ANNEE ? 24
    : auj.a < ANNEE || auj.m < 12 ? 0
    : Math.min(auj.j, 24);

  function lireOuvertes() {
    try { return JSON.parse(localStorage.getItem(CLE_STOCKAGE)) || []; } catch (e) { return []; }
  }
  function enregistrerOuverte(jour) {
    if (apercu) return;
    var liste = lireOuvertes();
    if (liste.indexOf(jour) === -1) liste.push(jour);
    try { localStorage.setItem(CLE_STOCKAGE, JSON.stringify(liste)); } catch (e) {}
  }
  var ouvertes = apercu ? films.map(function (f) { return f.jour; }) : lireOuvertes();

  function film(jour) { return films[jour - 1]; }
  function estDebloquee(jour) { return jour <= debloquees; }
  function dateTexte(jour) { return (jour === 1 ? "1er" : jour) + " décembre"; }
  function jourSemaine(jour) {
    return new Date(Date.UTC(ANNEE, 11, jour)).toLocaleDateString("fr-FR", { weekday: "long", timeZone: "UTC" });
  }
  function echapper(t) {
    return String(t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function paragraphes(texte, classe) {
    return texte.split(/\n+/).map(function (p) {
      var court = p.length < 60 && classe ? ' class="' + classe + '"' : "";
      return "<p" + court + ">" + echapper(p) + "</p>";
    }).join("");
  }
  function listeNoms(noms) {
    if (noms.length < 2) return noms.join("");
    return noms.slice(0, -1).join(", ") + " et " + noms[noms.length - 1];
  }

  // ---------- Construction du calendrier ----------
  var grille = document.getElementById("calendrier");

  function dessinerCase(jour, i) {
    var f = film(jour);
    var b = document.createElement("button");
    b.type = "button";
    b.className = "case";
    b.dataset.jour = jour;
    b.style.setProperty("--i", i);
    b.innerHTML =
      '<span class="case-inner">' +
        '<span class="face porte"><span class="num">' + jour + '</span><span class="mois">déc.</span></span>' +
        '<span class="face scene"><span class="pastille">' + jour + "</span></span>" +
      "</span>";
    majCase(b, f);
    b.addEventListener("click", function () { clicCase(b, jour); });
    return b;
  }

  function majCase(b, f) {
    var jour = f.jour;
    var debloq = estDebloquee(jour);
    var ouverte = debloq && ouvertes.indexOf(jour) !== -1;
    b.classList.toggle("fermee", !debloq);
    b.classList.toggle("prete", debloq && !ouverte);
    b.classList.toggle("ouverte", ouverte);
    if (ouverte) {
      b.querySelector(".scene").style.backgroundImage = "url('" + f.scene + "')";
      b.setAttribute("aria-label", "Case du " + dateTexte(jour) + " : " + f.titre);
    } else if (debloq) {
      b.setAttribute("aria-label", "Ouvrir la case du " + dateTexte(jour));
    } else {
      b.setAttribute("aria-label", "Case du " + dateTexte(jour) + ", pas encore disponible");
    }
  }

  ORDRE.forEach(function (jour, i) { if (film(jour)) grille.appendChild(dessinerCase(jour, i)); });

  function caseDe(jour) { return grille.querySelector('.case[data-jour="' + jour + '"]'); }

  function clicCase(b, jour) {
    if (!estDebloquee(jour)) {
      b.classList.remove("secoue"); void b.offsetWidth; b.classList.add("secoue");
      toast("Cette case s'ouvre le " + jourSemaine(jour) + " " + dateTexte(jour) + ".");
      return;
    }
    if (ouvertes.indexOf(jour) === -1) {
      ouvertes.push(jour);
      enregistrerOuverte(jour);
      majCase(b, film(jour));
      majStatut();
      setTimeout(function () { ouvrirFiche(jour); }, 750);
    } else {
      ouvrirFiche(jour);
    }
  }

  // ---------- La fiche ----------
  var dialog = document.getElementById("fiche");
  var contenu = document.getElementById("fiche-contenu");

  function ouvrirFiche(jour) {
    var f = film(jour);
    if (!f || !estDebloquee(jour)) return;
    var recherche = encodeURIComponent(f.titreVF || f.titre);

    // Bloc-générique façon affiche : rôle en petit, noms en grand
    function ligneGenerique(role, noms, classe, suite) {
      return '<p class="' + (classe || "") + '"><span class="role">' + role + '</span><span class="noms">' +
        noms.map(echapper).join(" · ") + "</span>" + (suite || "") + "</p>";
    }
    var generique = "";
    if (f.realisation.length) generique += ligneGenerique("Réalisation", f.realisation);
    if (f.scenario.length) generique += ligneGenerique("Scénario", f.scenario, "",
      f.roman.length ? '<span class="roman">d\'après le roman de ' + echapper(listeNoms(f.roman)) + "</span>" : "");
    if (f.casting.length) generique += ligneGenerique("Avec", f.casting, "avec");

    function listePlateformes(liste) {
      return liste.map(function (p) { return '<span class="nom">' + echapper(p) + "</span>"; })
        .join('<span class="sep" aria-hidden="true">/</span> ');
    }
    var seances =
      '<div class="ligne"><dt>Avec abonnement</dt>' +
        (f.abonnement.length ? "<dd>" + listePlateformes(f.abonnement) + "</dd>"
          : '<dd class="rien">Pas disponible en abonnement en ce moment.</dd>') + "</div>" +
      (f.location.length ? '<div class="ligne secondaire"><dt>Location ou achat</dt><dd>' + listePlateformes(f.location) + "</dd></div>" : "");

    contenu.innerHTML =
      '<div class="fiche-haut">' +
        '<img class="fiche-affiche" src="' + f.affiche + '" alt="Affiche du film ' + echapper(f.titre) + '" width="500" height="750">' +
        "<div>" +
          '<p class="fiche-date">' + jourSemaine(jour) + " " + dateTexte(jour) + "</p>" +
          '<h2 class="fiche-titre" id="fiche-titre">' + echapper(f.titre) + "</h2>" +
          '<p class="fiche-vf">' + (f.titreVF ? "(VF : " + echapper(f.titreVF) + "), " : "") +
            '<span class="fiche-annee">' + f.annee + "</span></p>" +
        "</div>" +
        '<div class="generique">' + generique + "</div>" +
      "</div>" +
      '<section class="bloc"><h3>Le pitch</h3>' + paragraphes(f.pitch) + "</section>" +
      '<section class="bloc"><h3>' + echapper(f.raisonsTitre) + '</h3><ol class="raisons">' +
        f.raisons.map(function (r, n) {
          return '<li><span class="chiffre" aria-hidden="true">' + (n + 1) + "</span><div>" + paragraphes(r, "court") + "</div></li>";
        }).join("") +
      "</ol></section>" +
      '<section class="bloc"><h3>Où regarder ?</h3>' +
        '<dl class="ou-regarder">' + seances + "</dl>" +
        '<p class="note">Disponibilités en France au ' + echapper(window.VERIF_PLATEFORMES || "") +
        '. Les catalogues changent souvent : <a href="https://www.justwatch.com/fr/recherche?q=' + recherche +
        '" target="_blank" rel="noopener">voir les offres à jour sur JustWatch</a>.</p>' +
      "</section>";

    contenu.scrollTop = 0;
    if (!dialog.open) dialog.showModal();
    history.replaceState(null, "", "#case-" + jour);
  }

  dialog.querySelector(".fermer").addEventListener("click", function () { dialog.close(); });
  dialog.addEventListener("click", function (e) { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener("close", function () {
    history.replaceState(null, "", location.pathname + location.search);
  });

  // ---------- Message d'accueil ----------
  var statut = document.getElementById("statut");
  function majStatut() {
    if (apercu) { statut.textContent = ""; return; }
    if (debloquees === 0) {
      var maintenant = Date.UTC(auj.a, auj.m - 1, auj.j);
      var jours = Math.round((Date.UTC(ANNEE, 11, 1) - maintenant) / 86400000);
      statut.textContent = jours > 1 ? "Première séance le 1er décembre, dans " + jours + " jours"
        : "Première séance le 1er décembre";
    } else if (auj.a === ANNEE && auj.m === 12 && auj.j <= 24) {
      var jourJ = auj.j;
      if (ouvertes.indexOf(jourJ) === -1) {
        statut.textContent = "La case du " + dateTexte(jourJ) + " est prête";
      } else if (jourJ < 24) {
        statut.textContent = "Prochaine séance demain, " + dateTexte(jourJ + 1);
      } else {
        statut.textContent = "Joyeux Noël, les 24 cases sont ouvertes";
      }
    } else {
      statut.textContent = "Les 24 cases sont ouvertes. Bonnes séances !";
    }
  }
  majStatut();
  if (apercu) document.getElementById("apercu").hidden = false;

  // ---------- Petit message ----------
  var toastEl = document.getElementById("toast"), minuteur;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("visible");
    clearTimeout(minuteur);
    minuteur = setTimeout(function () { toastEl.classList.remove("visible"); }, 2600);
  }

  // ---------- Étincelles ----------
  var etincelles = document.querySelector(".etincelles");
  for (var k = 0; etincelles && k < 34; k++) {
    var s = document.createElement("span");
    s.style.left = Math.random() * 100 + "%";
    s.style.top = Math.random() * 100 + "%";
    s.style.animationDelay = (Math.random() * 5).toFixed(2) + "s";
    s.style.animationDuration = (3.5 + Math.random() * 4).toFixed(2) + "s";
    etincelles.appendChild(s);
  }

  // ---------- Lien direct vers une case (#case-5) ----------
  var m = location.hash.match(/^#case-(\d{1,2})$/);
  if (m) {
    var jourLien = Number(m[1]);
    if (film(jourLien) && estDebloquee(jourLien)) {
      if (ouvertes.indexOf(jourLien) === -1) {
        ouvertes.push(jourLien);
        enregistrerOuverte(jourLien);
        majCase(caseDe(jourLien), film(jourLien));
        majStatut();
      }
      ouvrirFiche(jourLien);
    }
  }
})();
