/* Language layer for the Shopify app: English, Français, Español, Deutsch.
   The app is written in English. Every piece of text it puts on screen is translated at the DOM level
   (text nodes + placeholder / aria-label / title), so no screen needs to know about languages.
   Rows below are [English, Français, Español, Deutsch]. Add a language = add a column + an entry in LANGS. */
(function () {
  "use strict";
  var LANGS = [
    { code: "en", name: "English", loc: "en-US" },
    { code: "fr", name: "Français", loc: "fr-FR" },
    { code: "es", name: "Español", loc: "es-ES" },
    { code: "de", name: "Deutsch", loc: "de-DE" }
  ];
  var COL = { en: 0, fr: 1, es: 2, de: 3 };

  var ROWS = [
    /* navigation + tabs */
    ["Home", "Accueil", "Inicio", "Start"],
    ["Orders", "Commandes", "Pedidos", "Bestellungen"],
    ["Products", "Produits", "Productos", "Produkte"],
    ["Menu", "Menu", "Menú", "Menü"],
    ["Sidekick", "Sidekick", "Sidekick", "Sidekick"],
    ["Tabs", "Onglets", "Pestañas", "Tabs"],
    ["Search", "Rechercher", "Buscar", "Suchen"],
    ["Back", "Retour", "Atrás", "Zurück"],
    ["Close", "Fermer", "Cerrar", "Schließen"],
    ["More", "Plus", "Más", "Mehr"],
    ["More actions", "Plus d'actions", "Más acciones", "Weitere Aktionen"],
    ["Settings", "Paramètres", "Configuración", "Einstellungen"],
    ["Notifications", "Notifications", "Notificaciones", "Benachrichtigungen"],
    ["Notification settings", "Paramètres de notification", "Configuración de notificaciones", "Benachrichtigungseinstellungen"],
    ["No notifications", "Aucune notification", "Sin notificaciones", "Keine Benachrichtigungen"],
    ["Language", "Langue", "Idioma", "Sprache"],
    ["Preferences", "Préférences", "Preferencias", "Einstellungen"],
    ["Account", "Compte", "Cuenta", "Konto"],
    ["Manage account", "Gérer le compte", "Administrar cuenta", "Konto verwalten"],
    ["Log out", "Se déconnecter", "Cerrar sesión", "Abmelden"],
    ["Help Center", "Centre d'aide", "Centro de ayuda", "Hilfe-Center"],
    ["Search the Help Center", "Rechercher dans le Centre d'aide", "Buscar en el Centro de ayuda", "Hilfe-Center durchsuchen"],
    ["Search the Shopify App Store", "Rechercher dans l'App Store Shopify", "Buscar en la Shopify App Store", "Shopify App Store durchsuchen"],
    ["Search customers", "Rechercher des clients", "Buscar clientes", "Kunden suchen"],
    ["Add", "Ajouter", "Añadir", "Hinzufügen"],
    ["Add store", "Ajouter une boutique", "Añadir tienda", "Shop hinzufügen"],
    ["Add photo", "Ajouter une photo", "Añadir foto", "Foto hinzufügen"],
    ["Add store photo", "Ajouter une photo de la boutique", "Añadir foto de la tienda", "Shop-Foto hinzufügen"],
    ["Add product", "Ajouter un produit", "Añadir producto", "Produkt hinzufügen"],
    ["Add customer", "Ajouter un client", "Añadir cliente", "Kunde hinzufügen"],
    ["Add a sales channel", "Ajouter un canal de vente", "Añadir un canal de ventas", "Vertriebskanal hinzufügen"],
    ["Add an account", "Ajouter un compte", "Añadir una cuenta", "Konto hinzufügen"],
    ["Add SEO to top products", "Ajouter du SEO aux meilleurs produits", "Añadir SEO a los productos principales", "SEO zu Top-Produkten hinzufügen"],
    ["Add tracking number", "Ajouter un numéro de suivi", "Añadir número de seguimiento", "Sendungsnummer hinzufügen"],
    ["Edit profile", "Modifier le profil", "Editar perfil", "Profil bearbeiten"],
    ["Profile picture", "Photo de profil", "Foto de perfil", "Profilbild"],
    ["Information", "Informations", "Información", "Informationen"],
    ["First name", "Prénom", "Nombre", "Vorname"],
    ["Last name", "Nom", "Apellidos", "Nachname"],
    ["Email address", "Adresse e-mail", "Correo electrónico", "E-Mail-Adresse"],
    ["Invalid email address.", "Adresse e-mail invalide.", "Correo electrónico no válido.", "Ungültige E-Mail-Adresse."],
    ["Phone (optional)", "Téléphone (facultatif)", "Teléfono (opcional)", "Telefon (optional)"],
    ["Enter at least a first or last name.", "Entre au moins un prénom ou un nom.", "Introduce al menos un nombre o apellido.", "Gib mindestens einen Vor- oder Nachnamen ein."],
    ["Save", "Enregistrer", "Guardar", "Speichern"],
    ["Profile saved", "Profil enregistré", "Perfil guardado", "Profil gespeichert"],
    ["Remove photo", "Supprimer la photo", "Eliminar foto", "Foto entfernen"],
    ["Couldn't load that photo", "Impossible de charger cette photo", "No se pudo cargar la foto", "Foto konnte nicht geladen werden"],
    ["My account", "Mon compte", "Mi cuenta", "Mein Konto"],
    ["Edit store", "Modifier la boutique", "Editar tienda", "Shop bearbeiten"],
    ["Store profile", "Profil de la boutique", "Perfil de la tienda", "Shop-Profil"],
    ["Store name", "Nom de la boutique", "Nombre de la tienda", "Shop-Name"],
    ["Store URL", "URL de la boutique", "URL de la tienda", "Shop-URL"],
    ["Web address", "Adresse web", "Dirección web", "Webadresse"],
    ["Store currency", "Devise de la boutique", "Moneda de la tienda", "Shop-Währung"],
    ["Currency", "Devise", "Moneda", "Währung"],
    ["Currency and region", "Devise et région", "Moneda y región", "Währung und Region"],
    ["Enter a store name.", "Saisis un nom de boutique.", "Introduce un nombre de tienda.", "Gib einen Shop-Namen ein."],
    ["Enter a valid web address (letters, numbers and dashes).", "Saisis une adresse web valide (lettres, chiffres et tirets).", "Introduce una dirección web válida (letras, números y guiones).", "Gib eine gültige Webadresse ein (Buchstaben, Zahlen und Bindestriche)."],
    ["Changing currency rebuilds the store with the new currency: orders start fresh and amounts are converted.", "Changer de devise reconstruit la boutique avec la nouvelle devise : les commandes repartent de zéro et les montants sont convertis.", "Cambiar la moneda reconstruye la tienda con la nueva moneda: los pedidos empiezan de cero y los importes se convierten.", "Beim Ändern der Währung wird der Shop neu aufgebaut: Bestellungen beginnen von vorn und Beträge werden umgerechnet."],

    /* home + analytics */
    ["Good morning", "Bonjour", "Buenos días", "Guten Morgen"],
    ["Good afternoon", "Bon après-midi", "Buenas tardes", "Guten Tag"],
    ["Good evening", "Bonsoir", "Buenas noches", "Guten Abend"],
    ["Good morning!", "Bonjour !", "¡Buenos días!", "Guten Morgen!"],
    ["Good afternoon!", "Bon après-midi !", "¡Buenas tardes!", "Guten Tag!"],
    ["Good evening!", "Bonsoir !", "¡Buenas noches!", "Guten Abend!"],
    ["How are sales today?", "Comment vont les ventes aujourd'hui ?", "¿Cómo van las ventas hoy?", "Wie laufen die Verkäufe heute?"],
    ["Here's your activity", "Voici ton activité", "Aquí tienes tu actividad", "Hier ist deine Aktivität"],
    ["Total sales", "Ventes totales", "Ventas totales", "Gesamtumsatz"],
    ["Total sales breakdown", "Détail des ventes totales", "Desglose de ventas totales", "Aufschlüsselung des Gesamtumsatzes"],
    ["Total sales by product", "Ventes totales par produit", "Ventas totales por producto", "Gesamtumsatz nach Produkt"],
    ["Total sales by sales channel", "Ventes totales par canal de vente", "Ventas totales por canal de ventas", "Gesamtumsatz nach Vertriebskanal"],
    ["Gross sales", "Ventes brutes", "Ventas brutas", "Bruttoumsatz"],
    ["Net sales", "Ventes nettes", "Ventas netas", "Nettoumsatz"],
    ["Discounts", "Remises", "Descuentos", "Rabatte"],
    ["Returns", "Retours", "Devoluciones", "Rücksendungen"],
    ["Shipping charges", "Frais d'expédition", "Gastos de envío", "Versandkosten"],
    ["Taxes", "Taxes", "Impuestos", "Steuern"],
    ["Fees", "Frais", "Comisiones", "Gebühren"],
    ["Average order value", "Valeur moyenne des commandes", "Valor medio del pedido", "Durchschnittlicher Bestellwert"],
    ["Conversion rate", "Taux de conversion", "Tasa de conversión", "Konversionsrate"],
    ["Conversion summary", "Résumé de la conversion", "Resumen de conversión", "Konversionsübersicht"],
    ["Sessions", "Sessions", "Sesiones", "Sitzungen"],
    ["Sessions by device type", "Sessions par type d'appareil", "Sesiones por tipo de dispositivo", "Sitzungen nach Gerätetyp"],
    ["Sessions by location", "Sessions par lieu", "Sesiones por ubicación", "Sitzungen nach Standort"],
    ["Page views", "Pages vues", "Vistas de página", "Seitenaufrufe"],
    ["Visitors right now", "Visiteurs en ce moment", "Visitantes ahora mismo", "Besucher gerade jetzt"],
    ["Active carts", "Paniers actifs", "Carritos activos", "Aktive Warenkörbe"],
    ["Checking out", "En train de payer", "En el proceso de pago", "Im Checkout"],
    ["Purchased", "Acheté", "Comprado", "Gekauft"],
    ["Abandoned checkouts", "Paiements abandonnés", "Pagos abandonados", "Abgebrochene Checkouts"],
    ["Top products", "Meilleurs produits", "Productos más vendidos", "Top-Produkte"],
    ["Customer behavior", "Comportement des clients", "Comportamiento de los clientes", "Kundenverhalten"],
    ["Attribution", "Attribution", "Atribución", "Zuordnung"],
    ["Analytics", "Statistiques", "Analíticas", "Analysen"],
    ["Reports", "Rapports", "Informes", "Berichte"],
    ["Live View", "Vue en direct", "Vista en vivo", "Live-Ansicht"],
    ["Live", "En direct", "En vivo", "Live"],
    ["View report", "Voir le rapport", "Ver informe", "Bericht ansehen"],
    ["Compare to", "Comparer à", "Comparar con", "Vergleichen mit"],
    ["Previous period", "Période précédente", "Periodo anterior", "Vorheriger Zeitraum"],
    ["Previous year", "Année précédente", "Año anterior", "Vorheriges Jahr"],
    ["No comparison", "Aucune comparaison", "Sin comparación", "Kein Vergleich"],
    ["Date range", "Période", "Intervalo de fechas", "Zeitraum"],
    ["Today", "Aujourd'hui", "Hoy", "Heute"],
    ["Yesterday", "Hier", "Ayer", "Gestern"],
    ["Last 7 days", "7 derniers jours", "Últimos 7 días", "Letzte 7 Tage"],
    ["Last 30 days", "30 derniers jours", "Últimos 30 días", "Letzte 30 Tage"],
    ["Last 90 days", "90 derniers jours", "Últimos 90 días", "Letzte 90 Tage"],
    ["Last 365 days", "365 derniers jours", "Últimos 365 días", "Letzte 365 Tage"],
    ["7 days", "7 jours", "7 días", "7 Tage"],
    ["30 days", "30 jours", "30 días", "30 Tage"],
    ["90 days", "90 jours", "90 días", "90 Tage"],
    ["365 days", "365 jours", "365 días", "365 Tage"],
    ["Just now", "À l'instant", "Ahora mismo", "Gerade eben"],
    ["now", "maintenant", "ahora", "jetzt"],
    ["Next payout", "Prochain versement", "Próximo pago", "Nächste Auszahlung"],
    ["Payout", "Versement", "Pago", "Auszahlung"],
    ["Payouts", "Versements", "Pagos", "Auszahlungen"],
    ["Payout balance", "Solde des versements", "Saldo de pagos", "Auszahlungsguthaben"],
    ["Transfer", "Transférer", "Transferir", "Überweisen"],
    ["Set up fast. Sell faster.", "Configurez rapidement. Vendez plus vite.", "Configura rápido. Vende más rápido.", "Schnell einrichten. Schneller verkaufen."],
    ["Create your store in minutes and make your first sale today", "Créez votre boutique en quelques minutes et réalisez votre première vente dès aujourd’hui", "Crea tu tienda en minutos y haz tu primera venta hoy", "Erstelle deinen Shop in wenigen Minuten und mache heute deinen ersten Verkauf"],
    ["Create your online store", "Créez votre boutique en ligne", "Crea tu tienda online", "Erstelle deinen Onlineshop"],
    ["Grow your audience", "Développez votre audience", "Haz crecer tu audiencia", "Vergrößere deine Zielgruppe"],
    ["Accept payments in person", "Accepter des paiements en personne", "Acepta pagos en persona", "Zahlungen vor Ort akzeptieren"],
    ["Review transfer", "Récapitulatif du virement", "Resumen de la transferencia", "Überweisung prüfen"],
    ["Check the details before sending.", "Vérifie les détails avant d'envoyer.", "Revisa los detalles antes de enviar.", "Prüfe die Details vor dem Senden."],
    ["Withdrawal fee", "Frais de retrait", "Comisión de retiro", "Auszahlungsgebühr"],
    ["Free", "Gratuit", "Gratis", "Kostenlos"],
    ["To", "Vers", "A", "An"],
    ["Arrival", "Arrivée", "Llegada", "Ankunft"],
    ["You receive", "Tu reçois", "Recibes", "Du erhältst"],
    ["Swipe to send", "Glisse pour envoyer", "Desliza para enviar", "Zum Senden wischen"],
    ["Sending…", "Envoi en cours…", "Enviando…", "Wird gesendet…"],
    ["Amount too low to cover the fees", "Montant trop bas pour couvrir les frais", "Importe demasiado bajo para cubrir las comisiones", "Betrag zu niedrig, um die Gebühren zu decken"],
    ["Continue", "Continuer", "Continuar", "Weiter"],
    ["Withdrawal method", "Moyen de retrait", "Método de retiro", "Auszahlungsmethode"],
    ["Choose how you want to receive your money.", "Choisis comment recevoir ton argent.", "Elige cómo quieres recibir tu dinero.", "Wähle, wie du dein Geld erhalten möchtest."],
    ["Bank account", "Compte bancaire", "Cuenta bancaria", "Bankkonto"],
    ["PayPal", "PayPal", "PayPal", "PayPal"],
    ["1 to 2 business days", "1 à 2 jours ouvrés", "1 o 2 días laborables", "1 bis 2 Werktage"],
    ["Usually within minutes", "Généralement en quelques minutes", "Normalmente en minutos", "In der Regel innerhalb von Minuten"],
    ["Choose an account", "Choisis un compte", "Elige una cuenta", "Konto auswählen"],
    ["Add a bank account", "Ajouter un compte bancaire", "Añadir una cuenta bancaria", "Bankkonto hinzufügen"],
    ["Save account", "Enregistrer le compte", "Guardar cuenta", "Konto speichern"],
    ["Remove", "Supprimer", "Eliminar", "Entfernen"],
    ["PayPal email", "E-mail PayPal", "Correo de PayPal", "PayPal-E-Mail"],
    ["Enter the email linked to your PayPal account.", "Saisis l'e-mail lié à ton compte PayPal.", "Introduce el correo vinculado a tu cuenta de PayPal.", "Gib die E-Mail-Adresse deines PayPal-Kontos ein."],
    ["Enter a valid email address", "Saisis une adresse e-mail valide", "Introduce un correo válido", "Gib eine gültige E-Mail-Adresse ein"],
    ["Select an account", "Sélectionne un compte", "Selecciona una cuenta", "Wähle ein Konto aus"],
    ["Account removed", "Compte supprimé", "Cuenta eliminada", "Konto entfernt"],
    ["Account added", "Compte ajouté", "Cuenta añadida", "Konto hinzugefügt"],
    ["Transferred", "Déjà viré", "Transferido", "Überwiesen"],
    ["No payouts yet", "Aucun versement pour l'instant", "Aún no hay pagos", "Noch keine Auszahlungen"],
    ["Your transfers will show up here.", "Tes virements apparaîtront ici.", "Tus transferencias aparecerán aquí.", "Deine Überweisungen erscheinen hier."],
    ["No bank account yet", "Aucun compte bancaire", "Ninguna cuenta bancaria", "Noch kein Bankkonto"],
    ["Transfer sent", "Virement envoyé", "Transferencia enviada", "Überweisung gesendet"],
    ["Available balance", "Solde disponible", "Saldo disponible", "Verfügbares Guthaben"],
    ["Amount", "Montant", "Importe", "Betrag"],
    ["Account holder", "Titulaire du compte", "Titular de la cuenta", "Kontoinhaber"],
    ["IBAN", "IBAN", "IBAN", "IBAN"],
    ["Max", "Max", "Máx.", "Max."],
    ["Bank transfer", "Virement bancaire", "Transferencia bancaria", "Banküberweisung"],
    ["Destination", "Destination", "Destino", "Ziel"],
    ["Transfer initiated", "Virement initié", "Transferencia iniciada", "Überweisung veranlasst"],
    ["Nothing to transfer", "Rien à transférer", "Nada que transferir", "Nichts zu überweisen"],
    ["Enter a valid amount", "Saisis un montant valide", "Introduce un importe válido", "Gib einen gültigen Betrag ein"],
    ["Amount is higher than your balance", "Le montant dépasse ton solde", "El importe supera tu saldo", "Der Betrag übersteigt dein Guthaben"],
    ["Enter the account holder's name", "Saisis le nom du titulaire du compte", "Introduce el nombre del titular de la cuenta", "Gib den Namen des Kontoinhabers ein"],
    ["Enter a valid IBAN", "Saisis un IBAN valide", "Introduce un IBAN válido", "Gib eine gültige IBAN ein"],
    ["Transfers to a bank account usually arrive within 1 to 2 business days.", "Les virements vers un compte bancaire arrivent généralement sous 1 à 2 jours ouvrés.", "Las transferencias a una cuenta bancaria suelen llegar en 1 o 2 días laborables.", "Überweisungen auf ein Bankkonto kommen in der Regel innerhalb von 1 bis 2 Werktagen an."],
    ["Payout today", "Versement aujourd'hui", "Pago hoy", "Auszahlung heute"],
    ["Payout tomorrow", "Versement demain", "Pago mañana", "Auszahlung morgen"],
    ["Balance", "Solde", "Saldo", "Guthaben"],
    ["Transfers", "Transferts", "Transferencias", "Überweisungen"],
    ["Scheduled", "Planifié", "Programado", "Geplant"],
    ["Paid out", "Versé", "Pagado", "Ausgezahlt"],
    ["Suggested", "Suggestions", "Sugerencias", "Vorschläge"],
    ["Desktop", "Ordinateur", "Escritorio", "Desktop"],
    ["Mobile", "Mobile", "Móvil", "Mobil"],
    ["Tablet", "Tablette", "Tableta", "Tablet"],

    /* menu sections */
    ["Growth", "Croissance", "Crecimiento", "Wachstum"],
    ["Marketing", "Marketing", "Marketing", "Marketing"],
    ["Campaigns", "Campagnes", "Campañas", "Kampagnen"],
    ["Automations", "Automatisations", "Automatizaciones", "Automatisierungen"],
    ["Content", "Contenu", "Contenido", "Inhalte"],
    ["Files", "Fichiers", "Archivos", "Dateien"],
    ["Media", "Médias", "Multimedia", "Medien"],
    ["Metaobjects", "Métaobjets", "Metaobjetos", "Metaobjekte"],
    ["Blog posts", "Articles de blog", "Entradas de blog", "Blogbeiträge"],
    ["Pages", "Pages", "Páginas", "Seiten"],
    ["Menus", "Menus", "Menús", "Menüs"],
    ["Markets", "Marchés", "Mercados", "Märkte"],
    ["Online Store", "Boutique en ligne", "Tienda online", "Onlineshop"],
    ["Online store", "Boutique en ligne", "Tienda online", "Onlineshop"],
    ["View on Online Store", "Voir sur la boutique en ligne", "Ver en la tienda online", "Im Onlineshop ansehen"],
    ["Themes", "Thèmes", "Temas", "Themes"],
    ["Inbox", "Boîte de réception", "Bandeja de entrada", "Posteingang"],
    ["Point of Sale", "Point de vente", "Punto de venta", "Point of Sale"],
    ["Shop", "Shop", "Shop", "Shop"],
    ["Facebook & Instagram", "Facebook et Instagram", "Facebook e Instagram", "Facebook & Instagram"],
    ["Google & YouTube", "Google et YouTube", "Google y YouTube", "Google & YouTube"],
    ["Apps", "Applications", "Aplicaciones", "Apps"],
    ["Finance", "Finances", "Finanzas", "Finanzen"],
    ["Customers", "Clients", "Clientes", "Kunden"],
    ["Customer", "Client", "Cliente", "Kunde"],
    ["Collections", "Collections", "Colecciones", "Kollektionen"],
    ["Catalogs", "Catalogues", "Catálogos", "Kataloge"],
    ["Inventory", "Stock", "Inventario", "Bestand"],
    ["Gift cards", "Cartes cadeaux", "Tarjetas regalo", "Geschenkgutscheine"],
    ["Segments", "Segments", "Segmentos", "Segmente"],
    ["Companies", "Entreprises", "Empresas", "Unternehmen"],
    ["Locations", "Emplacements", "Ubicaciones", "Standorte"],
    ["Location", "Emplacement", "Ubicación", "Standort"],
    ["Shop location", "Emplacement de la boutique", "Ubicación de la tienda", "Shop-Standort"],
    ["All locations", "Tous les emplacements", "Todas las ubicaciones", "Alle Standorte"],
    ["Warehouse", "Entrepôt", "Almacén", "Lager"],
    ["Shopify Email", "Shopify Email", "Shopify Email", "Shopify Email"],
    ["Shopify Flow", "Shopify Flow", "Shopify Flow", "Shopify Flow"],
    ["Sidekick Pulse", "Sidekick Pulse", "Sidekick Pulse", "Sidekick Pulse"],
    ["opens on the full admin", "s'ouvre dans l'interface d'administration complète", "se abre en el panel completo", "öffnet sich im vollständigen Admin"],

    /* orders */
    ["All", "Toutes", "Todos", "Alle"],
    ["Open", "Ouvertes", "Abiertos", "Offen"],
    ["Archived", "Archivées", "Archivados", "Archiviert"],
    ["Unfulfilled", "Non traitées", "Sin preparar", "Nicht erfüllt"],
    ["Unpaid", "Non payées", "Sin pagar", "Unbezahlt"],
    ["Fulfilled", "Traitée", "Preparado", "Erfüllt"],
    ["Partially fulfilled", "Partiellement traitée", "Preparado parcialmente", "Teilweise erfüllt"],
    ["Paid", "Payée", "Pagado", "Bezahlt"],
    ["Partially refunded", "Partiellement remboursée", "Reembolsado parcialmente", "Teilweise erstattet"],
    ["Refunded", "Remboursée", "Reembolsado", "Erstattet"],
    ["Voided", "Annulée", "Anulado", "Storniert"],
    ["Authorized", "Autorisée", "Autorizado", "Autorisiert"],
    ["Payment pending", "Paiement en attente", "Pago pendiente", "Zahlung ausstehend"],
    ["Pending", "En attente", "Pendiente", "Ausstehend"],
    ["Payment captured", "Paiement capturé", "Pago capturado", "Zahlung erfasst"],
    ["Capture payment", "Capturer le paiement", "Capturar pago", "Zahlung erfassen"],
    ["Capture payments", "Capturer les paiements", "Capturar pagos", "Zahlungen erfassen"],
    ["Capture", "Capturer", "Capturar", "Erfassen"],
    ["Expected payment", "Paiement attendu", "Pago esperado", "Erwartete Zahlung"],
    ["Order marked as paid", "Commande marquée comme payée", "Pedido marcado como pagado", "Bestellung als bezahlt markiert"],
    ["Mark as paid", "Marquer comme payée", "Marcar como pagado", "Als bezahlt markieren"],
    ["Fulfill items", "Traiter les articles", "Preparar artículos", "Artikel erfüllen"],
    ["Fulfill orders", "Traiter les commandes", "Preparar pedidos", "Bestellungen erfüllen"],
    ["Fulfill by:", "À traiter avant le :", "Preparar antes del:", "Erfüllen bis:"],
    ["Items fulfilled", "Articles traités", "Artículos preparados", "Erfüllte Artikel"],
    ["Orders fulfilled", "Commandes traitées", "Pedidos preparados", "Erfüllte Bestellungen"],
    ["Unfulfilled orders", "Commandes non traitées", "Pedidos sin preparar", "Nicht erfüllte Bestellungen"],
    ["Picked up in store", "Retirée en magasin", "Recogido en tienda", "Im Geschäft abgeholt"],
    ["Create order", "Créer une commande", "Crear pedido", "Bestellung erstellen"],
    ["Create draft order", "Créer un brouillon de commande", "Crear pedido borrador", "Bestellentwurf erstellen"],
    ["Edit order", "Modifier la commande", "Editar pedido", "Bestellung bearbeiten"],
    ["Order number", "Numéro de commande", "Número de pedido", "Bestellnummer"],
    ["Order risk", "Risque de la commande", "Riesgo del pedido", "Bestellrisiko"],
    ["Chargeback risk is low", "Le risque de litige est faible", "El riesgo de contracargo es bajo", "Rückbuchungsrisiko ist niedrig"],
    ["Chargeback risk is medium", "Le risque de litige est moyen", "El riesgo de contracargo es medio", "Rückbuchungsrisiko ist mittel"],
    ["Chargeback risk is high", "Le risque de litige est élevé", "El riesgo de contracargo es alto", "Rückbuchungsrisiko ist hoch"],
    ["Low", "Faible", "Bajo", "Niedrig"],
    ["Medium", "Moyen", "Medio", "Mittel"],
    ["High", "Élevé", "Alto", "Hoch"],
    ["Timeline", "Chronologie", "Cronología", "Zeitleiste"],
    ["Notes", "Notes", "Notas", "Notizen"],
    ["No notes from customer", "Aucune note du client", "Sin notas del cliente", "Keine Notizen vom Kunden"],
    ["Contact information", "Coordonnées", "Información de contacto", "Kontaktinformationen"],
    ["No contact details", "Aucune coordonnée", "Sin datos de contacto", "Keine Kontaktdaten"],
    ["No phone number", "Aucun numéro de téléphone", "Sin número de teléfono", "Keine Telefonnummer"],
    ["Email details", "Détails de l'e-mail", "Detalles del correo", "E-Mail-Details"],
    ["Phone details", "Détails du téléphone", "Detalles del teléfono", "Telefondetails"],
    ["Shipping", "Expédition", "Envío", "Versand"],
    ["Shipping carrier", "Transporteur", "Transportista", "Versanddienstleister"],
    ["Tracking number", "Numéro de suivi", "Número de seguimiento", "Sendungsnummer"],
    ["Track", "Suivre", "Rastrear", "Verfolgen"],
    ["In transit", "En transit", "En tránsito", "Unterwegs"],
    ["Opening tracking…", "Ouverture du suivi…", "Abriendo seguimiento…", "Sendungsverfolgung wird geöffnet…"],
    ["Preparing packing slip…", "Préparation du bordereau…", "Preparando albarán…", "Lieferschein wird vorbereitet…"],
    ["Print", "Imprimer", "Imprimir", "Drucken"],
    ["Print packing slip", "Imprimer le bordereau de livraison", "Imprimir albarán", "Lieferschein drucken"],
    ["Send shipment details to your customer now", "Envoyer les détails d'expédition au client maintenant", "Enviar ahora los detalles del envío al cliente", "Versanddetails jetzt an den Kunden senden"],
    ["Standard", "Standard", "Estándar", "Standard"],
    ["Express", "Express", "Exprés", "Express"],
    ["Economy", "Économique", "Económico", "Economy"],
    ["Express Shipping", "Livraison express", "Envío exprés", "Expressversand"],
    ["Free Shipping", "Livraison gratuite", "Envío gratuito", "Kostenloser Versand"],
    ["Subtotal", "Sous-total", "Subtotal", "Zwischensumme"],
    ["Total", "Total", "Total", "Gesamt"],
    ["Total price", "Prix total", "Precio total", "Gesamtpreis"],
    ["Included", "Inclus", "Incluido", "Enthalten"],
    ["Item", "Article", "Artículo", "Artikel"],
    ["Card", "Carte", "Tarjeta", "Karte"],
    ["Charge", "Facturer", "Cobrar", "Belasten"],
    ["Custom amount", "Montant personnalisé", "Importe personalizado", "Benutzerdefinierter Betrag"],
    ["Custom discount", "Remise personnalisée", "Descuento personalizado", "Benutzerdefinierter Rabatt"],
    ["Discount", "Remise", "Descuento", "Rabatt"],
    ["Quick sale", "Vente rapide", "Venta rápida", "Schnellverkauf"],
    ["Enter an amount", "Saisis un montant", "Introduce un importe", "Betrag eingeben"],
    ["Hold the card near the top of your phone", "Approche la carte du haut de ton téléphone", "Acerca la tarjeta a la parte superior del teléfono", "Halte die Karte an die Oberseite deines Telefons"],
    ["Apple Pay", "Apple Pay", "Apple Pay", "Apple Pay"],
    ["Order confirmation email was sent to", "L'e-mail de confirmation de commande a été envoyé à", "El correo de confirmación del pedido se envió a", "Die Bestellbestätigung wurde gesendet an"],
    ["No orders found", "Aucune commande trouvée", "No se encontraron pedidos", "Keine Bestellungen gefunden"],
    ["Try changing the filters or search term", "Essaie de modifier les filtres ou le terme de recherche", "Prueba a cambiar los filtros o el término de búsqueda", "Ändere die Filter oder den Suchbegriff"],
    ["Try a different search term", "Essaie un autre terme de recherche", "Prueba con otro término de búsqueda", "Versuche einen anderen Suchbegriff"],
    ["Filter", "Filtrer", "Filtrar", "Filtern"],
    ["Filter orders", "Filtrer les commandes", "Filtrar pedidos", "Bestellungen filtern"],
    ["Filter products", "Filtrer les produits", "Filtrar productos", "Produkte filtern"],
    ["Sort", "Trier", "Ordenar", "Sortieren"],
    ["Sort by", "Trier par", "Ordenar por", "Sortieren nach"],
    ["Date (newest first)", "Date (plus récentes d'abord)", "Fecha (más recientes primero)", "Datum (neueste zuerst)"],
    ["Date (oldest first)", "Date (plus anciennes d'abord)", "Fecha (más antiguas primero)", "Datum (älteste zuerst)"],
    ["Status", "Statut", "Estado", "Status"],
    ["Select", "Sélectionner", "Seleccionar", "Auswählen"],
    ["Select products", "Sélectionner des produits", "Seleccionar productos", "Produkte auswählen"],
    ["Copy", "Copier", "Copiar", "Kopieren"],
    ["Copied", "Copié", "Copiado", "Kopiert"],
    ["Share", "Partager", "Compartir", "Teilen"],
    ["Attach", "Joindre", "Adjuntar", "Anhängen"],
    ["Clear", "Effacer", "Borrar", "Löschen"],
    ["Create", "Créer", "Crear", "Erstellen"],
    ["Keep", "Conserver", "Conservar", "Behalten"],
    ["Duplicate", "Dupliquer", "Duplicar", "Duplizieren"],
    ["Archive", "Archiver", "Archivar", "Archivieren"],
    ["Expand", "Développer", "Expandir", "Erweitern"],
    ["Manage", "Gérer", "Administrar", "Verwalten"],
    ["Enter", "Entrer", "Entrar", "Eingeben"],
    ["Cancel", "Annuler", "Cancelar", "Abbrechen"],
    ["Done", "Terminé", "Listo", "Fertig"],
    ["Delete", "Supprimer", "Eliminar", "Löschen"],
    ["Edit", "Modifier", "Editar", "Bearbeiten"],
    ["Draft", "Brouillon", "Borrador", "Entwurf"],
    ["Drafts", "Brouillons", "Borradores", "Entwürfe"],
    ["Active", "Actif", "Activo", "Aktiv"],
    ["Default", "Par défaut", "Predeterminado", "Standard"],
    ["Type", "Type", "Tipo", "Typ"],
    ["Title", "Titre", "Título", "Titel"],
    ["Tags", "Tags", "Etiquetas", "Tags"],
    ["Plus", "Plus", "Plus", "Plus"],
    ["Navigation", "Navigation", "Navegación", "Navigation"],

    /* products */
    ["Price", "Prix", "Precio", "Preis"],
    ["Pricing", "Tarification", "Precios", "Preisgestaltung"],
    ["Compare-at price", "Prix avant promotion", "Precio de comparación", "Vergleichspreis"],
    ["Compare-at price should be higher than the price.", "Le prix avant promotion doit être supérieur au prix.", "El precio de comparación debe ser mayor que el precio.", "Der Vergleichspreis muss höher als der Preis sein."],
    ["Enter a valid compare-at price.", "Saisis un prix avant promotion valide.", "Introduce un precio de comparación válido.", "Gib einen gültigen Vergleichspreis ein."],
    ["Enter a valid price.", "Saisis un prix valide.", "Introduce un precio válido.", "Gib einen gültigen Preis ein."],
    ["Product type", "Type de produit", "Tipo de producto", "Produkttyp"],
    ["Product organization", "Organisation du produit", "Organización del producto", "Produktorganisation"],
    ["Product saved", "Produit enregistré", "Producto guardado", "Produkt gespeichert"],
    ["Archive product", "Archiver le produit", "Archivar producto", "Produkt archivieren"],
    ["Variants", "Variantes", "Variantes", "Varianten"],
    ["Vendor", "Fournisseur", "Proveedor", "Anbieter"],
    ["Options, separated by commas", "Options, séparées par des virgules", "Opciones, separadas por comas", "Optionen, durch Kommas getrennt"],
    ["Untitled product", "Produit sans titre", "Producto sin título", "Unbenanntes Produkt"],
    ["No products found", "Aucun produit trouvé", "No se encontraron productos", "Keine Produkte gefunden"],
    ["Available", "Disponible", "Disponible", "Verfügbar"],
    ["0 available", "0 disponible", "0 disponibles", "0 verfügbar"],
    ["Low inventory", "Stock faible", "Inventario bajo", "Niedriger Bestand"],
    ["(some out of stock)", "(certains en rupture de stock)", "(algunos agotados)", "(einige nicht vorrätig)"],
    ["in stock", "en stock", "en stock", "auf Lager"],
    ["Sold (last 30 days)", "Vendus (30 derniers jours)", "Vendidos (últimos 30 días)", "Verkauft (letzte 30 Tage)"],
    ["Visible on your store and available to buy.", "Visible sur ta boutique et disponible à l'achat.", "Visible en tu tienda y disponible para comprar.", "In deinem Shop sichtbar und kaufbar."],
    ["Hidden from your store. It won't receive orders.", "Masqué sur ta boutique. Il ne recevra pas de commandes.", "Oculto en tu tienda. No recibirá pedidos.", "In deinem Shop ausgeblendet. Es erhält keine Bestellungen."],
    ["Camera access is needed to scan barcodes", "L'accès à la caméra est nécessaire pour scanner les codes-barres", "Se necesita acceso a la cámara para escanear códigos de barras", "Für das Scannen von Barcodes ist Kamerazugriff erforderlich"],

    /* customers */
    ["Customer since", "Client depuis", "Cliente desde", "Kunde seit"],
    ["Customer for", "Client depuis", "Cliente desde hace", "Kunde seit"],
    ["Edit customer", "Modifier le client", "Editar cliente", "Kunde bearbeiten"],
    ["No customer", "Aucun client", "Sin cliente", "Kein Kunde"],
    ["Last order placed", "Dernière commande passée", "Último pedido realizado", "Letzte Bestellung"],
    ["Amount spent", "Montant dépensé", "Importe gastado", "Ausgegebener Betrag"],
    ["Address", "Adresse", "Dirección", "Adresse"],
    ["Billing", "Facturation", "Facturación", "Rechnung"],
    ["Send account invite", "Envoyer une invitation de compte", "Enviar invitación de cuenta", "Kontoeinladung senden"],
    ["Subscribed to email marketing", "Abonné au marketing par e-mail", "Suscrito al marketing por correo", "Für E-Mail-Marketing angemeldet"],
    ["Not subscribed to email marketing", "Non abonné au marketing par e-mail", "No suscrito al marketing por correo", "Nicht für E-Mail-Marketing angemeldet"],

    /* search + sidekick */
    ["Recent searches", "Recherches récentes", "Búsquedas recientes", "Letzte Suchen"],
    ["Filters are not available yet", "Les filtres ne sont pas encore disponibles", "Los filtros aún no están disponibles", "Filter sind noch nicht verfügbar"],
    ["Everything", "Tout", "Todo", "Alles"],
    ["No recent searches", "Aucune recherche récente", "Sin búsquedas recientes", "Keine letzten Suchen"],
    ["Chat history", "Historique du chat", "Historial del chat", "Chatverlauf"],
    ["Work with Sidekick", "Travailler avec Sidekick", "Trabajar con Sidekick", "Mit Sidekick arbeiten"],
    ["No previous chats", "Aucune discussion précédente", "Sin chats anteriores", "Keine früheren Chats"],
    ["Attachments are not available yet", "Les pièces jointes ne sont pas encore disponibles", "Los adjuntos aún no están disponibles", "Anhänge sind noch nicht verfügbar"],
    ["Ask anything...", "Pose une question...", "Pregunta lo que quieras...", "Frag etwas..."],
    ["Ask anything…", "Pose une question…", "Pregunta lo que quieras…", "Frag etwas…"],
    ["How can I help?", "Comment puis-je aider ?", "¿Cómo puedo ayudarte?", "Wie kann ich helfen?"],
    ["What's new?", "Quoi de neuf ?", "¿Qué hay de nuevo?", "Was gibt es Neues?"],
    ["What are my best sellers?", "Quels sont mes meilleurs produits ?", "¿Cuáles son mis más vendidos?", "Was sind meine Bestseller?"],
    ["Which orders need attention?", "Quelles commandes demandent mon attention ?", "¿Qué pedidos necesitan atención?", "Welche Bestellungen brauchen Aufmerksamkeit?"],
    ["Write a product description", "Rédiger une description de produit", "Escribir una descripción de producto", "Produktbeschreibung schreiben"],
    ["See what's happening in your store right now", "Vois ce qui se passe dans ta boutique en ce moment", "Mira lo que está pasando en tu tienda ahora mismo", "Sieh, was gerade in deinem Shop passiert"],
    ["See what's driving it", "Vois ce qui l'explique", "Mira qué lo impulsa", "Sieh, was dahintersteckt"],
    ["Sidekick can now edit your theme from your phone", "Sidekick peut maintenant modifier ton thème depuis ton téléphone", "Sidekick ahora puede editar tu tema desde el teléfono", "Sidekick kann dein Theme jetzt vom Handy aus bearbeiten"],
    ["Sidekick is working on it", "Sidekick s'en occupe", "Sidekick está trabajando en ello", "Sidekick arbeitet daran"],
    ["New conversation", "Nouvelle conversation", "Nueva conversación", "Neue Unterhaltung"],
    ["Private chat", "Discussion privée", "Chat privado", "Privater Chat"],
    ["Private mode on", "Mode privé activé", "Modo privado activado", "Privatmodus an"],
    ["Voice", "Voix", "Voz", "Sprache"],
    ["Listening…", "Écoute…", "Escuchando…", "Hört zu…"],
    ["Good response", "Bonne réponse", "Buena respuesta", "Gute Antwort"],
    ["Bad response", "Mauvaise réponse", "Mala respuesta", "Schlechte Antwort"],
    ["Capture more search shoppers", "Capte plus de visiteurs venus des moteurs de recherche", "Capta más compradores desde las búsquedas", "Gewinne mehr Käufer über die Suche"],
    ["Menu", "Menu", "Menú", "Menü"],

    /* weekdays + months (full) */
    ["Monday", "Lundi", "Lunes", "Montag"], ["Tuesday", "Mardi", "Martes", "Dienstag"],
    ["Wednesday", "Mercredi", "Miércoles", "Mittwoch"], ["Thursday", "Jeudi", "Jueves", "Donnerstag"],
    ["Friday", "Vendredi", "Viernes", "Freitag"], ["Saturday", "Samedi", "Sábado", "Samstag"],
    ["Sunday", "Dimanche", "Domingo", "Sonntag"],
    ["January", "janvier", "enero", "Januar"], ["February", "février", "febrero", "Februar"],
    ["March", "mars", "marzo", "März"], ["April", "avril", "abril", "April"],
    ["May", "mai", "mayo", "Mai"], ["June", "juin", "junio", "Juni"],
    ["July", "juillet", "julio", "Juli"], ["August", "août", "agosto", "August"],
    ["September", "septembre", "septiembre", "September"], ["October", "octobre", "octubre", "Oktober"],
    ["November", "novembre", "noviembre", "November"], ["December", "décembre", "diciembre", "Dezember"],

    /* countries + currencies */
    ["United States", "États-Unis", "Estados Unidos", "Vereinigte Staaten"],
    ["Canada", "Canada", "Canadá", "Kanada"], ["United Kingdom", "Royaume-Uni", "Reino Unido", "Vereinigtes Königreich"],
    ["Australia", "Australie", "Australia", "Australien"], ["Germany", "Allemagne", "Alemania", "Deutschland"],
    ["France", "France", "Francia", "Frankreich"], ["Spain", "Espagne", "España", "Spanien"],
    ["Italy", "Italie", "Italia", "Italien"], ["Netherlands", "Pays-Bas", "Países Bajos", "Niederlande"],
    ["Belgium", "Belgique", "Bélgica", "Belgien"], ["Switzerland", "Suisse", "Suiza", "Schweiz"],
    ["Sweden", "Suède", "Suecia", "Schweden"], ["Ireland", "Irlande", "Irlanda", "Irland"],
    ["New Zealand", "Nouvelle-Zélande", "Nueva Zelanda", "Neuseeland"], ["India", "Inde", "India", "Indien"],
    ["Singapore", "Singapour", "Singapur", "Singapur"], ["Japan", "Japon", "Japón", "Japan"],
    ["Brazil", "Brésil", "Brasil", "Brasilien"], ["Mexico", "Mexique", "México", "Mexiko"],
    ["United Arab Emirates", "Émirats arabes unis", "Emiratos Árabes Unidos", "Vereinigte Arabische Emirate"],
    ["US Dollar", "Dollar américain", "Dólar estadounidense", "US-Dollar"], ["Euro", "Euro", "Euro", "Euro"],
    ["British Pound", "Livre sterling", "Libra esterlina", "Britisches Pfund"],
    ["Canadian Dollar", "Dollar canadien", "Dólar canadiense", "Kanadischer Dollar"],
    ["Australian Dollar", "Dollar australien", "Dólar australiano", "Australischer Dollar"],
    ["Japanese Yen", "Yen japonais", "Yen japonés", "Japanischer Yen"],
    ["Facebook", "Facebook", "Facebook", "Facebook"], ["Instagram", "Instagram", "Instagram", "Instagram"],
    ["Google", "Google", "Google", "Google"], ["TikTok", "TikTok", "TikTok", "TikTok"],

    /* misc sentences built from fragments (kept in the same word order) */
    ["Ship to customer •", "Expédier au client •", "Enviar al cliente •", "Versand an Kunden •"],
    ["No results for “", "Aucun résultat pour « ", "Sin resultados para «", "Keine Ergebnisse für „"],
    ["Hidden", "Masqué", "Oculto", "Ausgeblendet"],
    ["units sold", "unités vendues", "unidades vendidas", "verkaufte Einheiten"],
    ["made up", "représentent", "representan", "machten"],
    ["visitors right now", "visiteurs en ce moment", "visitantes ahora mismo", "Besucher gerade jetzt"],
    ["to fulfill", "à traiter", "por preparar", "zu erfüllen"],
    ["to capture", "à capturer", "por capturar", "zu erfassen"],
    ["You have", "Tu as", "Tienes", "Du hast"],
    ["Your store has", "Ta boutique a", "Tu tienda tiene", "Dein Shop hat"],
    ["customers and", "clients et", "clientes y", "Kunden und"],
    ["from Google", "depuis Google", "desde Google", "von Google"],
    ["Today you've made", "Aujourd'hui, tu as réalisé", "Hoy has hecho", "Heute hast du"],
    ["Your sales over the last 30 days are", "Tes ventes des 30 derniers jours s'élèvent à", "Tus ventas de los últimos 30 días son", "Dein Umsatz der letzten 30 Tage beträgt"],
    ["Your best seller over the last 30 days is", "Ton meilleur produit des 30 derniers jours est", "Tu producto más vendido de los últimos 30 días es", "Dein Bestseller der letzten 30 Tage ist"],
    ["the customer", "le client", "el cliente", "der Kunde"],
    ["placed this order on", "a passé cette commande le", "realizó este pedido el", "hat diese Bestellung aufgegeben am"],
    ["payment was authorized on", "le paiement a été autorisé le", "el pago fue autorizado el", "die Zahlung wurde autorisiert am"],
    ["payment was processed on", "le paiement a été traité le", "el pago se procesó el", "die Zahlung wurde verarbeitet am"],
    ["refund was processed", "le remboursement a été traité", "se procesó el reembolso", "die Erstattung wurde verarbeitet"],
    ["to the account ending in", "sur le compte se terminant par", "a la cuenta que termina en", "auf das Konto mit der Endung"],
    ["Try again", "Réessayer", "Reintentar", "Erneut versuchen"],
    ["Draft Orders", "Commandes brouillons", "Pedidos borrador", "Bestellentwürfe"],
    ["Sales channels", "Canaux de vente", "Canales de venta", "Vertriebskanäle"],
    ["Purchase orders", "Bons de commande", "Órdenes de compra", "Bestellungen beim Lieferanten"],
    ["Standard Shipping", "Livraison standard", "Envío estándar", "Standardversand"],
    ["Scan inventory", "Scanner le stock", "Escanear inventario", "Bestand scannen"],
    ["Review inventory", "Examiner le stock", "Revisar inventario", "Bestand prüfen"],
    ["Return fees", "Frais de retour", "Gastos de devolución", "Rücksendegebühren"],
    ["Returning customer rate", "Taux de clients récurrents", "Tasa de clientes recurrentes", "Rate wiederkehrender Kunden"],
    ["Conversion rate", "Taux de conversion", "Tasa de conversión", "Konversionsrate"],
    ["Sales", "Ventes", "Ventas", "Verkäufe"],
    ["Visitors", "Visiteurs", "Visitantes", "Besucher"],
    ["Order", "Commande", "Pedido", "Bestellung"],
    ["Product", "Produit", "Producto", "Produkt"],
    ["Get your first order", "Recevez votre première commande", "Recibe tu primer pedido", "Erhalte deine erste Bestellung"],
    ["Use Quick Sale to sell anywhere, to anyone, right from your phone", "Utilisez Quick Sale pour vendre n’importe où et à n’importe qui, simplement avec votre téléphone", "Usa Quick Sale para vender en cualquier lugar y a cualquiera, directamente desde tu teléfono", "Verkaufe mit Quick Sale überall und an jeden, direkt von deinem Telefon aus"],
    ["Set up Quick Sale", "Configurer Quick Sale", "Configurar Quick Sale", "Quick Sale einrichten"],
    ["Add your first product", "Ajoutez votre premier produit", "Añade tu primer producto", "Füge dein erstes Produkt hinzu"],
    ["Start by adding products to your store that your customers will love", "Commencez par ajouter à votre boutique des produits que vos clients adoreront", "Empieza añadiendo a tu tienda productos que tus clientes van a adorar", "Füge deinem Shop zuerst Produkte hinzu, die deine Kunden lieben werden"],
    ["Add your products", "Ajouter vos produits", "Añadir tus productos", "Produkte hinzufügen"],
    ["Other ways to add products", "Autres façons d’ajouter des produits", "Otras formas de añadir productos", "Weitere Möglichkeiten, Produkte hinzuzufügen"],
    ["Discover products to sell", "Découvrir des produits à vendre", "Descubrir productos para vender", "Produkte zum Verkaufen entdecken"],
    ["Add a sample product", "Ajouter un exemple de produit", "Añadir un producto de ejemplo", "Beispielprodukt hinzufügen"],
    ["Subscribe to keep selling", "Abonnez-vous pour continuer à vendre", "Suscríbete para seguir vendiendo", "Abonniere, um weiter zu verkaufen"],
    ["3 days left", "3 jours restants", "Quedan 3 días", "Noch 3 Tage"],
    ["Product sourcing opens on the full admin", "La recherche de produits s’ouvre dans l’admin complet", "La búsqueda de productos se abre en el admin completo", "Die Produktsuche öffnet sich im vollständigen Admin"],
    ["Choose a plan on the full admin", "Choisissez un abonnement dans l’admin complet", "Elige un plan en el admin completo", "Wähle einen Tarif im vollständigen Admin"],
    ["Sample product added", "Exemple de produit ajouté", "Producto de ejemplo añadido", "Beispielprodukt hinzugefügt"]
  ];

  var DICT = { fr: {}, es: {}, de: {} }, TO_EN = {};
  function norm(s) { return String(s).replace(/[‘’]/g, "'").replace(/\s+/g, " "); }
  ROWS.forEach(function (r) {
    var en = norm(r[0]);
    TO_EN[en] = en;
    DICT.fr[en] = r[1]; DICT.es[en] = r[2]; DICT.de[en] = r[3];
    for (var i = 1; i < r.length; i++) { var k = norm(r[i]); if (!TO_EN[k]) TO_EN[k] = en; }   // the app has a few French originals
  });

  var lang = "en";
  function loc() { return LANGS[COL[lang]].loc; }

  /* ── dynamic text (numbers, dates, names inside the sentence) ── */
  var MON_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var T = {
    ago: { fr: ["il y a {n} min", "il y a {n} h", "il y a {n} j"], es: ["hace {n} min", "hace {n} h", "hace {n} d"], de: ["vor {n} Min.", "vor {n} Std.", "vor {n} T."] },
    order: { fr: "Commande n°{n}", es: "Pedido n.º {n}", de: "Bestellung Nr. {n}" },
    items: { fr: ["{n} article", "{n} articles", "depuis"], es: ["{n} artículo", "{n} artículos", "de"], de: ["{n} Artikel", "{n} Artikel", "aus"] },
    at: { fr: "à", es: "a las", de: "um" }
  };
  function fill(s, n) { return s.replace("{n}", n); }
  function to24(t) {
    var m = /^(\d{1,2}):(\d{2})\s?([AP])M$/i.exec(t); if (!m) return t;
    var h = +m[1] % 12; if (m[3].toUpperCase() === "P") h += 12;
    return (h < 10 ? "0" : "") + h + ":" + m[2];
  }
  function dateWord(s) {                       // "Oct 24" / "Oct 24, 2025" / "Oct" => localized
    var m = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? (\d{1,2})(?:, (\d{4}))?$/.exec(s);
    if (!m) return null;
    try {
      var d = new Date(m[3] ? +m[3] : 2001, MON_SHORT.indexOf(m[1]), +m[2]);
      return d.toLocaleDateString(loc(), m[3] ? { day: "numeric", month: "short", year: "numeric" } : { day: "numeric", month: "short" });
    } catch (e) { return null; }
  }
  function patterns(s) {
    var m, L = lang;
    if ((m = /^(\d+)([mhd]) ago$/.exec(s))) return fill(T.ago[L][{ m: 0, h: 1, d: 2 }[m[2]]], m[1]);
    if ((m = /^Order #(\d+)$/.exec(s))) return fill(T.order[L], m[1]);
    if ((m = /^(.*), (\d+) items? from (.+?) • (.+)$/.exec(s))) {
      var ch = tr(m[3]) || m[3], n = +m[2];
      return m[1] + ", " + fill(T.items[L][n === 1 ? 0 : 1], n) + " " + (T.items[L][2] + " " + ch) + " • " + m[4];
    }
    if ((m = /^(.+?) at (\d{1,2}:\d{2}\s?[AP]M)(?: \u2022 (.+))?$/i.exec(s))) {
      var dd = tr(m[1]) || dateWord(m[1]) || m[1];
      return dd + " " + T.at[L] + " " + to24(m[2]) + (m[3] ? " \u2022 " + (tr(m[3]) || m[3]) : "");
    }
    if ((m = /^(\d{1,2}:\d{2}\s?[AP]M)$/i.exec(s))) return to24(s);
    if ((m = dateWord(s))) return m;
    if ((m = /^Ship to customer • (.+)$/.exec(s))) return (tr("Ship to customer •") || "") + " " + m[1];
    if ((m = /^No results for “(.*)”$/.exec(s))) return (tr("No results for “") || "") + m[1] + (L === "fr" ? " »" : L === "es" ? "»" : "“");
    return rules(s);
  }

  /* Whole sentences that the app builds with numbers inside (Sidekick answers, Pulse cards, chart titles). */
  function pl(n, one, many) { return String(n) === "1" ? one : many; }
  var RULES = [
    [/^([\d.,]+) available(?: · (\d+) variants?)?$/, function (m, L) { var v = m[2]; return m[1] + " " + { fr: pl(m[1], "disponible", "disponibles"), es: pl(m[1], "disponible", "disponibles"), de: "verfügbar" }[L] + (v ? " · " + v + " " + { fr: pl(v, "variante", "variantes"), es: pl(v, "variante", "variantes"), de: pl(v, "Variante", "Varianten") }[L] : ""); }],
    [/^([\d.,]+) units sold$/, function (m, L) { return m[1] + " " + { fr: pl(m[1], "unité vendue", "unités vendues"), es: pl(m[1], "unidad vendida", "unidades vendidas"), de: "verkaufte Einheiten" }[L]; }],
    [/^([\d.,]+) sessions over (\d+) days?$/, function (m, L) { return { fr: m[1] + " sessions sur " + m[2] + " " + pl(m[2], "jour", "jours"), es: m[1] + " sesiones en " + m[2] + " " + pl(m[2], "día", "días"), de: m[1] + " Sitzungen in " + m[2] + " " + pl(m[2], "Tag", "Tagen") }[L]; }],
    [/^(.+) • (\d+) items? • (\d{1,2}:\d{2}\s?[AP]M)$/i, function (m, L) { return m[1] + " • " + m[2] + " " + { fr: pl(m[2], "article", "articles"), es: pl(m[2], "artículo", "artículos"), de: "Artikel" }[L] + " • " + to24(m[3]); }],
    [/^(\d+) orders?$/, function (m, L) { return m[1] + " " + { fr: pl(m[1], "commande", "commandes"), es: pl(m[1], "pedido", "pedidos"), de: pl(m[1], "Bestellung", "Bestellungen") }[L]; }],
    [/^(\d+) items?$/, function (m, L) { return m[1] + " " + { fr: pl(m[1], "article", "articles"), es: pl(m[1], "artículo", "artículos"), de: "Artikel" }[L]; }],
    [/^(\d+)(?:st|nd|rd|th) session was from (.+)$/, function (m, L) { return { fr: "La 1re session venait de " + m[2], es: "La 1.ª sesión fue desde " + m[2], de: "Die 1. Sitzung kam von " + m[2] }[L].replace("1", m[1]); }],
    [/^This is their (\d+)(?:st|nd|rd|th) order$/, function (m, L) { var n = m[1]; return { fr: "C'est sa " + (n === "1" ? "1re" : n + "e") + " commande", es: "Es su pedido n.º " + n, de: "Das ist seine " + n + ". Bestellung" }[L]; }],
    [/^Estimated (.+)$/, function (m, L) { var d = tr(m[1]) || m[1]; return { fr: "Prévu le " + d, es: "Previsto el " + d, de: "Voraussichtlich " + d }[L]; }],
    [/^Payouts in (\d+) days?$/, function (m, L) { return { fr: "Versements dans " + m[1] + " " + pl(m[1], "jour", "jours"), es: "Pagos en " + m[1] + " " + pl(m[1], "día", "días"), de: "Auszahlungen in " + m[1] + " " + pl(m[1], "Tag", "Tagen") }[L]; }],
    [/^(.+) placed this order on (.+)\.$/, function (m, L) { var ch = tr(m[2]) || m[2]; return { fr: m[1] + " a passé cette commande sur " + ch + ".", es: m[1] + " realizó este pedido en " + ch + ".", de: m[1] + " hat diese Bestellung über " + ch + " aufgegeben." }[L]; }],
    [/^A (.+) payment was (processed|authorized) on (.+)\.$/, function (m, L) { var pr = m[2] === "processed"; return { fr: "Un paiement de " + m[1] + " a été " + (pr ? "traité" : "autorisé") + " sur " + m[3] + ".", es: "Un pago de " + m[1] + " se " + (pr ? "procesó" : "autorizó") + " con " + m[3] + ".", de: "Eine Zahlung von " + m[1] + " wurde " + (pr ? "verarbeitet" : "autorisiert") + " über " + m[3] + "." }[L]; }],
    [/^Order confirmation email was sent to (.+)\.$/, function (m, L) { return { fr: "L'e-mail de confirmation de commande a été envoyé à " + m[1] + ".", es: "El correo de confirmación del pedido se envió a " + m[1] + ".", de: "Die Bestellbestätigung wurde an " + m[1] + " gesendet." }[L]; }],
    [/^(.+) over time$/, function (m, L) { var x = tr(m[1]) || m[1]; return { fr: x + " au fil du temps", es: x + " a lo largo del tiempo", de: x + " im Zeitverlauf" }[L]; }],
    [/^(\d+) of (\d+)$/, function (m, L) { return m[1] + " " + { fr: "sur", es: "de", de: "von" }[L] + " " + m[2]; }],
    [/^(\d{1,2}) ([AP])M$/i, function (m, L) { var h = +m[1] % 12 + (m[2].toUpperCase() === "P" ? 12 : 0); return { fr: h + " h", es: h + ":00", de: h + " Uhr" }[L]; }],
    [/^Keep (.+) in stock$/, function (m, L) { return { fr: "Garde " + m[1] + " en stock", es: "Mantén " + m[1] + " en stock", de: "Halte " + m[1] + " auf Lager" }[L]; }],
    [/^Sales are (up|down) (\d+)%$/, function (m, L) { var u = m[1] === "up"; return { fr: "Les ventes sont en " + (u ? "hausse" : "baisse") + " de " + m[2] + " %", es: "Las ventas " + (u ? "suben" : "bajan") + " un " + m[2] + " %", de: "Der Umsatz ist um " + m[2] + " % " + (u ? "gestiegen" : "gesunken") }[L]; }],
    [/^(.+) made up (\d+)% of units sold in the last 30 days\. At this pace, the (.+) you have left will last about (\d+) days?\.$/, function (m, L) {
      return { fr: m[1] + " représente " + m[2] + " % des unités vendues sur les 30 derniers jours. À ce rythme, les " + m[3] + " restants dureront environ " + m[4] + " " + pl(m[4], "jour", "jours") + ".",
        es: m[1] + " representó el " + m[2] + " % de las unidades vendidas en los últimos 30 días. A este ritmo, las " + m[3] + " que te quedan durarán unos " + m[4] + " " + pl(m[4], "día", "días") + ".",
        de: m[1] + " machte " + m[2] + " % der in den letzten 30 Tagen verkauften Einheiten aus. In diesem Tempo reichen die verbleibenden " + m[3] + " etwa " + m[4] + " " + pl(m[4], "Tag", "Tage") + "." }[L]; }],
    [/^Your sales over the last 30 days are (.+?), up from (.+?) the 30 days before\. Most of the lift came from returning customers\.$/, function (m, L) {
      return { fr: "Tes ventes des 30 derniers jours s'élèvent à " + m[1] + ", contre " + m[2] + " sur les 30 jours précédents. L'essentiel de la hausse vient de clients récurrents.",
        es: "Tus ventas de los últimos 30 días son " + m[1] + ", frente a " + m[2] + " en los 30 días anteriores. Gran parte del aumento vino de clientes recurrentes.",
        de: "Dein Umsatz der letzten 30 Tage beträgt " + m[1] + " nach " + m[2] + " in den 30 Tagen davor. Der Zuwachs kam größtenteils von wiederkehrenden Kunden." }[L]; }],
    [/^Over the last 90 days, search converted at ([\d.]+)% vs\. ([\d.]+)% from social, but it's a small slice of traffic and your top products have no SEO titles or descriptions\.$/, function (m, L) {
      return { fr: "Sur les 90 derniers jours, la recherche a converti à " + m[1] + " % contre " + m[2] + " % pour les réseaux sociaux, mais c'est une petite part du trafic et tes meilleurs produits n'ont ni titre ni description SEO.",
        es: "En los últimos 90 días, la búsqueda convirtió al " + m[1] + " % frente al " + m[2] + " % de las redes sociales, pero es una pequeña parte del tráfico y tus mejores productos no tienen títulos ni descripciones SEO.",
        de: "In den letzten 90 Tagen konvertierte die Suche mit " + m[1] + " % gegenüber " + m[2] + " % aus sozialen Netzwerken, macht aber nur einen kleinen Teil des Traffics aus, und deine Top-Produkte haben keine SEO-Titel oder -Beschreibungen." }[L]; }],
    [/^Today you've made (.+?) from (.+?) orders?\. Over the last 30 days, total sales are (.+?)(?:, (up|down) (\d+)% from the 30 days before\.|\.)$/, function (m, L) {
      var u = m[4] === "up", one = m[2] === "1", ch = m[4] ? true : false;
      return { fr: "Aujourd'hui, tu as réalisé " + m[1] + " avec " + m[2] + " " + (one ? "commande" : "commandes") + ". Sur les 30 derniers jours, les ventes totales s'élèvent à " + m[3] + (ch ? ", en " + (u ? "hausse" : "baisse") + " de " + m[5] + " % par rapport aux 30 jours précédents." : "."),
        es: "Hoy has hecho " + m[1] + " con " + m[2] + " " + (one ? "pedido" : "pedidos") + ". En los últimos 30 días, las ventas totales son " + m[3] + (ch ? ", un " + m[5] + " % " + (u ? "más" : "menos") + " que en los 30 días anteriores." : "."),
        de: "Heute hast du " + m[1] + " mit " + m[2] + " " + (one ? "Bestellung" : "Bestellungen") + " umgesetzt. In den letzten 30 Tagen beträgt der Gesamtumsatz " + m[3] + (ch ? ", " + m[5] + " % " + (u ? "mehr" : "weniger") + " als in den 30 Tagen davor." : ".") }[L]; }],
    [/^Your best seller over the last 30 days is (.+) with (.+) units sold(?:, followed by (.+) \((.+)\))?\.$/, function (m, L) {
      return { fr: "Ton meilleur produit des 30 derniers jours est " + m[1] + " avec " + m[2] + " unités vendues" + (m[3] ? ", suivi de " + m[3] + " (" + m[4] + ")" : "") + ".",
        es: "Tu producto más vendido de los últimos 30 días es " + m[1] + " con " + m[2] + " unidades vendidas" + (m[3] ? ", seguido de " + m[3] + " (" + m[4] + ")" : "") + ".",
        de: "Dein Bestseller der letzten 30 Tage ist " + m[1] + " mit " + m[2] + " verkauften Einheiten" + (m[3] ? ", gefolgt von " + m[3] + " (" + m[4] + ")" : "") + "." }[L]; }],
    [/^You have (\d+) orders? to fulfill(?: and (\d+) payments? to capture)?\. The oldest unfulfilled order is #(\d+)\.$/, function (m, L) {
      var u = m[1], c = m[2];
      return { fr: "Tu as " + u + " " + pl(u, "commande", "commandes") + " à traiter" + (c ? " et " + c + " " + pl(c, "paiement", "paiements") + " à capturer" : "") + ". La plus ancienne commande non traitée est la n°" + m[3] + ".",
        es: "Tienes " + u + " " + pl(u, "pedido", "pedidos") + " por preparar" + (c ? " y " + c + " " + pl(c, "pago", "pagos") + " por capturar" : "") + ". El pedido sin preparar más antiguo es el n.º " + m[3] + ".",
        de: "Du hast " + u + " " + pl(u, "Bestellung", "Bestellungen") + " zu erfüllen" + (c ? " und " + c + " " + pl(c, "Zahlung", "Zahlungen") + " zu erfassen" : "") + ". Die älteste nicht erfüllte Bestellung ist Nr. " + m[3] + "." }[L]; }],
    [/^Here's a draft for (.+): Made for everyday wear, the (.+) pairs a clean silhouette with materials that hold up wash after wash\. It's the piece you'll reach for first\.$/, function (m, L) {
      return { fr: "Voici un brouillon pour " + m[1] + " :\n\nPensé pour tous les jours, " + m[2] + " associe une silhouette épurée à des matières qui tiennent lavage après lavage. C'est la pièce que tu enfileras en premier.",
        es: "Aquí tienes un borrador para " + m[1] + ":\n\nPensado para el día a día, " + m[2] + " combina una silueta limpia con materiales que aguantan lavado tras lavado. Es la prenda que cogerás primero.",
        de: "Hier ist ein Entwurf für " + m[1] + ":\n\nFür jeden Tag gemacht, verbindet " + m[2] + " eine klare Silhouette mit Materialien, die Wäsche für Wäsche halten. Es ist das Teil, zu dem du zuerst greifst." }[L]; }],
    [/^Your store has (.+) customers and (.+) orders in the last 30 days\. I can dig into sales, products, orders or customers, or help you write and edit content\.$/, function (m, L) {
      return { fr: "Ta boutique compte " + m[1] + " clients et " + m[2] + " commandes sur les 30 derniers jours. Je peux analyser les ventes, les produits, les commandes ou les clients, ou t'aider à rédiger et modifier du contenu.",
        es: "Tu tienda tiene " + m[1] + " clientes y " + m[2] + " pedidos en los últimos 30 días. Puedo analizar ventas, productos, pedidos o clientes, o ayudarte a escribir y editar contenido.",
        de: "Dein Shop hat " + m[1] + " Kunden und " + m[2] + " Bestellungen in den letzten 30 Tagen. Ich kann Verkäufe, Produkte, Bestellungen oder Kunden analysieren oder dir beim Schreiben und Bearbeiten von Inhalten helfen." }[L]; }]
  ];
  function rules(s) {
    if (s.length > 400) return null;
    for (var i = 0; i < RULES.length; i++) { var m = RULES[i][0].exec(s); if (m) { var o = RULES[i][1](m, lang); if (o) return o; } }
    return null;
  }
  function tr(raw) {                            // translate one string, or null when there is nothing to do
    if (lang === "en" && !/[^\x00-\x7F]/.test(raw)) return null;
    var lead = /^\s*/.exec(raw)[0], trail = /\s*$/.exec(raw)[0], core = raw.slice(lead.length, raw.length - trail.length);
    if (!core) return null;
    var key = norm(core), en = TO_EN[key], out = null;
    if (lang === "en") out = en && en !== key ? en : null;
    else if (en && DICT[lang][en] != null) out = DICT[lang][en];
    else out = patterns(key);
    if (out == null || out === core) return null;
    return lead + out + trail;
  }

  /* ── DOM layer ── */
  var textState = new WeakMap(), attrState = new WeakMap();
  var ATTRS = ["placeholder", "aria-label", "title"];
  function skip(el) {
    for (; el && el.nodeType === 1; el = el.parentNode) {
      var t = el.tagName;
      if (t === "SCRIPT" || t === "STYLE" || t === "TEXTAREA" || t === "NOSCRIPT" || t === "CODE") return true;
      if (el.hasAttribute && (el.hasAttribute("data-no-i18n") || el.isContentEditable)) return true;
    }
    return false;
  }
  function doText(node) {
    var cur = node.nodeValue, st = textState.get(node);
    var orig = st && st.t === cur ? st.o : cur;          // an unchanged node: start again from its original text
    if (!orig || !/\S/.test(orig) || skip(node.parentNode)) return;
    var t = tr(orig), want = t == null ? orig : t;
    textState.set(node, { o: orig, t: want });
    if (node.nodeValue !== want) node.nodeValue = want;
  }
  function doAttrs(el) {
    if (!el.getAttribute || skip(el)) return;
    var rec = attrState.get(el); if (!rec) { rec = {}; attrState.set(el, rec); }
    ATTRS.forEach(function (a) {
      var cur = el.getAttribute(a); if (cur == null) return;
      var st = rec[a];
      if (st && st.t === cur) cur = st.o;
      var t = tr(cur);
      rec[a] = { o: cur, t: t == null ? cur : t };
      if ((t == null ? cur : t) !== el.getAttribute(a)) el.setAttribute(a, t == null ? cur : t);
    });
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1) return;
    doAttrs(root);
    var w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null), n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) doText(n); else doAttrs(n); }
  }
  var queue = [], scheduled = false, observer = null;
  function flush() {
    scheduled = false;
    if (observer) observer.disconnect();
    var q = queue; queue = [];
    q.forEach(walk);
    attach();
  }
  function attach() {
    if (!observer) return;
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  function enqueue(list) {
    list.forEach(function (m) {
      if (m.type === "childList") m.addedNodes.forEach(function (n) { queue.push(n); });
      else queue.push(m.target);
    });
  }
  function start() {
    observer = new MutationObserver(function (list) {
      enqueue(list);
      if (queue.length) flush();                      // same microtask: translated before the browser paints or measures
    });
    walk(document.body);
    attach();
  }
  function apply(root) {
    // disconnect() throws away mutations the observer has not delivered yet (e.g. a whole screen just rebuilt
    // with innerHTML, like Home after pull-to-refresh), which left them untranslated: take them first.
    if (observer) { enqueue(observer.takeRecords()); observer.disconnect(); }
    walk(root || document.body);
    var q = queue; queue = [];
    q.forEach(walk);
    attach();
  }
  function refresh() { if (observer) observer.disconnect(); walk(document.body); attach(); }

  /* ── public API ── */
  function detect() {
    var saved = null;
    try { saved = localStorage.getItem("sh-lang"); } catch (e) { }
    if (saved && COL[saved] != null) return saved;
    var nav = String((navigator.languages && navigator.languages[0]) || navigator.language || "en").slice(0, 2).toLowerCase();
    return COL[nav] != null ? nav : "en";
  }
  function setLang(code) {
    if (COL[code] == null) return;
    lang = code;
    try { localStorage.setItem("sh-lang", code); } catch (e) { }
    document.documentElement.lang = code;
    refresh();
  }
  lang = detect();
  document.documentElement.lang = lang;
  window.I18N = { en: function (t) { var k = TO_EN[norm(String(t).trim())]; return k || t; }, langs: LANGS, get lang() { return lang; }, set: setLang, tr: function (s) { var t = tr(String(s)); return t == null ? s : t; }, refresh: refresh, apply: apply };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
