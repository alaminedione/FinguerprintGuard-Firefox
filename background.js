// Configuration par défaut
const defaultSettings = {
  //
  spoofNavigator: false,
  spoofUserAgent: false,
  spoofCanvas: false,
  blockImages: false,
  blockJS: false,
  //
  autoReloadAll: false,
  autoReloadCurrent: false,
  //
  platform: 'random',
  language: 'random',
  hardwareConcurrency: 0,
  deviceMemory: 0,
  minVersion: 0,
  maxVersion: 0,
  //
  uaPlatform: 'random',
  uaPlatformVersion: 'random',
  uaArchitecture: 'random',
  uaBitness: 'random',
  uaWow64: 'random',
  uaModel: 'random',
  uaFullVersion: 'random',
  //
  browser: 'random',
  secChUa: 'random',
  secChUaMobile: 'random',
  secChUaPlatform: 'random',
  secChUaFullVersion: 'random',
  secChUaPlatformVersion: 'random',
  hDeviceMemory: 'random',
  referer: '',
  contentEncoding: 'random'
};

//initialisation des paramètres depuis le storage
let settings = { ...defaultSettings };
browser.storage.sync.get(settings, (stored) => {
  settings = { ...defaultSettings, ...stored };
});

//écoute des changements de paramètres et mettre a jour les regles
browser.storage.onChanged.addListener((changes) => {
  for (let [key, { newValue }] of Object.entries(changes)) {
    settings[key] = newValue;
  }
  //on recharge les pages ou non selon les paramètres defini par l'utilisateur
  handleAutoReload();
});

//écoute les messages envoyés 
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'getStatus') {
    //retourne les paramètres actuels
    sendResponse(settings);
    // return true;
  } else if (message.type === 'updateSetting') {
    //met à jour le parametre
    browser.storage.sync.set({ [message.setting]: message.value });
    // return true;
  }
});


//écoute les navigations  et injecter les scripts selon les parametres
browser.webNavigation.onCommitted.addListener((details) => {
  if (details.url.startsWith('browser://') || details.url.startsWith("about:-extension://")) {
    return;
  } else {

    //usurper le canvas
    if (settings.spoofCanvas) {
      browser.scripting.executeScript({
        target: { tabId: details.tabId },
        files: ['./spoofer/spoof-canvas.js'],
        injectImmediately: true,
        world: 'MAIN'
      }).then((result) => {
        console.log('Script injecté dans le canvas:', result);
      }).catch((error) => {
        console.error('Erreur lors de l\'injection du script:', error);
      });
    }

    //usurper le Navigator
    if (settings.spoofNavigator) {
      browser.scripting.executeScript({
        target: { tabId: details.tabId },
        injectImmediately: true,
        world: 'MAIN',
        func: applySpoofingNavigator,
        args: [settings]
      }).then((result) => {
        console.log('Script injecté dans le Navigator:', result);
      }).catch((error) => {
        console.error('Erreur lors de l\'injection du script:', error);
      });
      browser.scripting.executeScript({
        target: { tabId: details.tabId },
        injectImmediately: true,
        world: 'MAIN',
        func: applyUserAgentDataSpoofing,
        args: [settings]
      }).then((result) => {
        console.log('Script injecté dans userAgentData:', result);
      }).catch((error) => {
        console.error('Erreur lors de l\'injection du script:', error);
      });
    }

    // Usurper le UserAgent
    if (settings.spoofUserAgent) {
      // const newRule = createRule("Chrome");
      const newRule = {
        id: 20,
        priority: 10,
        action: {
          type: "modifyHeaders", requestHeaders: [{
            header: "User-Agent",
            operation: "set",
            // value: " Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36"
            value: generateUserAgent(settings.browser, settings.uaPlatform)
          },
          {
            header: "referer",
            operation: "set",
            value: " "
          },
          ]
        },
        condition: {
          urlFilter: "*",
          resourceTypes: [
            "beacon",
            "media",
            "ping",
            "main_frame",
            "sub_frame",
            "stylesheet",
            "script",
            "image",
            "font",
            "xmlhttprequest",
            "other"
          ],
        },
      }
      browser.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [20], // Éviter la duplication
        addRules: [newRule]
      }).then((result) => {
        console.log('Règle modifiée:', result);
      }).catch((error) => {
        console.error('Erreur lors de la modification de la règle:', error);
      });

      // console.log(`Activation de la nouvelle règle: ${newRule[0].id}`); // Accessing the first rule's ID

      if (!settings.spoofNavigator) {
        console.log("Spoof the navigator user agent niveau javascript");

        // Inject scripts as needed
        browser.scripting.executeScript({
          target: { tabId: details.tabId },
          injectImmediately: true,
          world: 'MAIN',
          func: applyUserAgentDataSpoofing,
          args: [settings]
        }).then((result) => {
          console.log('Script injecté dans userAgentData:', result);
        }).catch((error) => {
          console.error('Erreur lors de l\'injection du script:', error);
        });

        browser.scripting.executeScript({
          target: { tabId: details.tabId },
          injectImmediately: true,
          world: 'MAIN',
          func: modifyUserAgent,
          args: [settings]
        }).then((result) => {
          console.log('Script injecté dans userAgent:', result);
        }).catch((error) => {
          console.error('Erreur lors de l\'injection du script:', error);
        });
      }
    } else {
      browser.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [20] // Ensure this matches the ID used when adding
      }).then(() => {
        console.log('Règle supprimée avec succès.');
      }).catch((error) => {
        console.error('Erreur lors de la suppression de la règle:', error);
      });
    }
  }
});




// Function to update blocking rules
function updateBlockingRules() {
  const rules = [];

  // Block JavaScript if setting is enabled
  if (settings.blockJS) {
    rules.push({
      id: 1, // Use an integer ID
      priority: 1,
      action: {
        type: "block"
      },
      condition: {
        urlFilter: ".*",
        resourceTypes: ["script"]
      }
    });
  }

  // Block images if setting is enabled
  if (settings.blockImages) {
    rules.push({
      id: 2, // Use a different integer ID
      priority: 1,
      action: {
        type: "block"
      },
      condition: {
        urlFilter: ".*",
        resourceTypes: ["image"]
      }
    });
  }

  // Update the blocking rules dynamically
  browser.declarativeNetRequest.updateDynamicRules({
    addRules: rules,
    removeRuleIds: [1, 2] // Remove previous rules by their integer IDs
  }).then(() => {
    console.log('Blocking rules updated successfully.');
  }).catch((error) => {
    console.error('Error updating blocking rules:', error);
  });
}

// Listen for navigation events to update blocking rules
browser.webNavigation.onBeforeNavigate.addListener((details) => {
  if (!details.url.startsWith('about:') && !details.url.startsWith('moz-extension')) {
    updateBlockingRules();
  }
});



//gerer le rechargement automatique des pages selon les parametres de l'utilisateur
async function handleAutoReload() {
  try {
    const { autoReloadAll, autoReloadCurrent } = await browser.storage.sync.get(['autoReloadAll', 'autoReloadCurrent']);

    if (autoReloadAll) {
      const tabs = await browser.tabs.query({});
      for (const tab of tabs) {
        if (!tab.url.startsWith('about:')) {
          await browser.tabs.reload(tab.id);
        }
      }
    } else if (autoReloadCurrent) {
      const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (activeTab && !activeTab.url.startsWith('about:') && !activeTab.url.startsWith('about:')) {
        await browser.tabs.reload(activeTab.id);
      }
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour des protections:', error);
  }
}


function applySpoofingNavigator(config) {
  try {
    const platforms = ['Windows NT 10.0', 'Windows NT 11.0', 'MacIntel', 'Linux x86_64'];
    const languages = {
      'fr-FR': ['fr-FR', 'fr'],
      'en-US': ['en-US', 'en'],
      'en-GB': ['en-GB', 'en'],
      'es-ES': ['es-ES', 'es'],
      'de-DE': ['de-DE', 'de']
    };

    // Adaptation des valeurs en fonction des spécifications de l'utilisateur
    const platform = config.platform === 'random' ? getRandomElement(platforms) : (config.platform || getRandomElement(platforms));
    const language = config.language === 'random' ? getRandomElement(Object.keys(languages)) : (config.language || getRandomElement(Object.keys(languages)));

    // Vérification des valeurs min/max pour le navigateur
    const minVersion = config.minVersion == 0 ? getRandomInRange(70, 100) : (config.minVersion || 70);
    const maxVersion = config.maxVersion == 0 ? getRandomInRange(minVersion, 120) : (config.maxVersion || 120);

    const browserVersion = generateBrowserVersion(minVersion, maxVersion);

    // Gestion des cœurs CPU et de la mémoire
    const hardwareConcurrency = config.hardwareConcurrency == 0 ? getRandomElement[2, 4, 8, 16] : parseInt(config.hardwareConcurrency);
    const deviceMemory = config.deviceMemory == 0 ? getRandomElement([4, 8, 16, 32]) : parseInt(config.deviceMemory);

    // Création de l'objet fakeNavigator
    const fakeNavigator = {
      platform: platform,
      userAgent: `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) browser/${browserVersion} Safari/537.36`,
      language: language,
      languages: languages[language],
      hardwareConcurrency: hardwareConcurrency,
      deviceMemory: deviceMemory,
      vendor: 'Google Inc.',
      maxTouchPoints: platform.includes('Windows') ? 0 : 5,
      cookieEnabled: true,
      doNotTrack: '1',
      appName: 'Netscape',
      appCodeName: 'Mozilla',
      onLine: true,
      appVersion: `5.0 (${platform} AppleWebKit/537.36 (KHTML, like Gecko) browser/${browserVersion} Safari/537.36)`,
      pdfViewerEnabled: true,
      scheduling: {
        isInputPending: () => false
      },
      connection: {
        effectiveType: getRandomElement(['4g', 'wifi']),
        rtt: getRandomInRange(50, 100),
        downlink: getRandomInRange(5, 15),
        saveData: false
      },
      mediaCapabilities: {
        decodingInfo: async () => ({
          supported: true,
          smooth: true,
          powerEfficient: true
        })
      }
    };

    // Définition des propriétés dans l'objet navigator
    for (let prop in fakeNavigator) {
      try {
        Object.defineProperty(navigator, prop, {
          get: () => fakeNavigator[prop],
          configurable: true,
          enumerable: true
        });
        console.log('Propriété modifiée:', prop + ' avec valeur:', fakeNavigator[prop]);
      } catch (e) {
        console.debug(`Impossible de modifier ${prop}:`, e);
      }
    }
  } catch (error) {
    console.error('Erreur lors du spoofing du navigator:', error);
  }

  // Fonctions utilitaires
  function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function getRandomInRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function generateBrowserVersion(minVersion, maxVersion) {
    const major = getRandomInRange(minVersion, maxVersion);
    const minor = getRandomInRange(0, 99);
    return `${major}.${minor}.0`;
  }
}


function applyUserAgentDataSpoofing(userAgentConfig) {
  try {
    // Définir des marques fictives
    const brands = [
      "Google browser",
      "Edge",
      // "Not=A?Brand",
      "Firefox",
      "Safari"
    ];

    // Créer des valeurs basées sur l'objet userAgentConfig
    const platform = userAgentConfig.uaPlatform === 'random' ? getRandomElement(["Linux", "Windows NT 10.0", "MacIntel", "Windows 11"]) : userAgentConfig.uaPlatform;
    const platformVersion = userAgentConfig.uaPlatformVersion === 'random' ? `${getRandomInRange(6, 12)}.${getRandomInRange(0, 10)}.${getRandomInRange(0, 100)}` : userAgentConfig.uaPlatformVersion;
    const architecture = userAgentConfig.uaArchitecture === 'random' ? getRandomElement(["x86", "x86_64"]) : userAgentConfig.uaArchitecture;
    const bitness = userAgentConfig.uaBitness === 'random' ? getRandomElement(["32", "64"]) : userAgentConfig.uaBitness;
    // const wow64 = (architecture === "x86_64") ? true : false; // Déterminer wow64 selon l'architecture
    const wow64 = userAgentConfig.uaWow64 === 'random' ? getRandomElement([true]) : userAgentConfig.uaWow64;
    const model = userAgentConfig.uaModel === 'random' ? getRandomElement(["", "Model X", "Model Y"]) : userAgentConfig.uaModel;
    const uaFullVersion = userAgentConfig.uaFullVersion === 'random' ? generateBrowserVersion(120, 130) : userAgentConfig.uaFullVersion;

    const brand = getRandomElement(brands)
    // Créer un objet userAgentData fictif
    const fakeUserAgentData = {
      get brands() {
        return [
          { brand: brand, version: generateBrowserVersion(120, 130) },
          { brand: getRandomElement(['Not=A?Brand']), version: generateBrowserVersion(8, 20) }
        ];
      },
      get mobile() {
        return false;
      },
      get platform() {
        return platform;
      },
      get platformVersion() {
        return platformVersion;
      },
      get architecture() {
        return architecture;
      },
      get bitness() {
        return bitness;
      },
      get wow64() {
        return wow64;
      },
      get model() {
        return model;
      },
      get uaFullVersion() {
        return uaFullVersion;
      },
      get fullVersionList() {
        return [
          { brand: brand, version: uaFullVersion },
          { brand: brand, version: generateBrowserVersion(120, 130) }
        ];
      }
    };

    // Définir la propriété userAgentData dans l'objet navigator
    Object.defineProperty(navigator, 'userAgentData', {
      value: fakeUserAgentData,
      configurable: true,
      enumerable: true
    });

    //oscpu
    Object.defineProperty(navigator, 'oscpu', {
      // value: getRandomElement(["Linux x86_64", "Windows NT 10.0", "Windows NT 11.0", "Intel Mac OS x 10.0"]),
      value: `${platform} ${getRandomElement(['11.0', '10.0'])}`,
      configurable: true,
      enumerable: true
    });

    console.log('userAgentData modifié:', navigator.userAgentData);

  } catch (error) {
    console.error('Erreur lors du spoofing de userAgentData:', error);
  }

  function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function getRandomInRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function generateBrowserVersion(minVersion, maxVersion) {
    const major = getRandomInRange(minVersion, maxVersion);
    const minor = getRandomInRange(0, 99);
    return `${major}.${minor}.0`;
  }
}





function modifyUserAgent(config) {
  const minVersion = config.minVersion === 0 ? getRandomInRange(70, 100) : (config.minVersion || 70);
  const maxVersion = config.maxVersion === 0 ? getRandomInRange(120, 130) : (config.maxVersion || 120);
  const uaPlatform = config.uaPlatform === 'random' ? getRandomElement(["Linux", "Windows NT 10.0", "MacIntel", "Windows 11"]) : config.uaPlatform;
  const browserVersion = generateBrowserVersion(minVersion, maxVersion);
  const userAgent = `Mozilla/5.0 (${uaPlatform}) AppleWebKit/537.36 (KHTML, like Gecko) browser/${browserVersion} Safari/537.36`

  Object.defineProperty(navigator, 'userAgent', {
    value: userAgent,
    configurable: true,
    enumerable: true
  });
  //platform
  Object.defineProperty(navigator, 'platform', {
    value: uaPlatform,
    configurable: true,
    enumerable: true
  })
  //appVersion
  Object.defineProperty(navigator, 'appVersion', {
    value: `5.0 (${uaPlatform} AppleWebKit/537.36 (KHTML, like Gecko) browser/${browserVersion} Safari/537.36)`,
    configurable: true,
    enumerable: true
  })

  function generateBrowserVersion(minVersion, maxVersion) {
    const major = getRandomInRange(minVersion, maxVersion);
    const minor = getRandomInRange(0, 99);
    return `${major}.${minor}.0`;
  }

  function getRandomInRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
}



const browsersVersions = {
  "Edge": [118, 117, 116],
  "Firefox": [131, 130, 129],
  "Safari": [17, 16, 15],
  "Chrome": [118, 117, 116],
  "Brave": [118, 117, 116],
  "Opera": [100, 99, 98],
  "Vivaldi": [6, 5, 4],
};

// Function to generate a random User-Agent
function generateUserAgent(browser, platform) {
  if (browser === "random") {
    browser = getRandomElement(Object.keys(browsersVersions));
  }
  if (platform === "random") {
    platform = getRandomElement(["Windows NT 10.0", "Windows NT 11.0", "MacIntel", "Linux x86_64"]);
  }

  const version = getRandomElement(browsersVersions[browser]);
  return `Mozilla/5.0 (${platform}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.${getRandomInRange(0, 999)} Safari/537.36`;
}


// Utility functions for getting random elements
function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

