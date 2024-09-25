async function loadModule() {
  if (typeof require !== "undefined") {
    // Node.js/CommonJS environment
    const { allSuttasPaliNameArray } = require("./data/allSuttasPaliNameArray");
    return allSuttasPaliNameArray;
  } else {
    // Browser ES module environment
    const module = await import("./data/allSuttasPaliNameArray.js");
    return module.allSuttasPaliNameArray;
  }
}

loadModule()
  .then(allSuttasPaliNameArray => {
    omniboxFeature(allSuttasPaliNameArray);
  })
  .catch(error => {
    console.error("Failed to load module:", error);
  });

function omniboxFeature(allSuttasPaliNameArray) {
  const BASE_URL = "https://suttacentral.net";
  const SEARCH_URL = `${BASE_URL}/search`;

  // Preprocess the sutta data for faster search
  const processedSuttas = allSuttasPaliNameArray.map(sutta => {
    const [title, id] = sutta.split(" | ");
    return {
      title: title.toLowerCase(),
      id: id.toLowerCase(),
      original: sutta,
    };
  });

  // Set the default suggestion to guide the user
  browser.omnibox.setDefaultSuggestion({
    description: `Type "sc" followed by a string to search SuttaCentral.net, or select a sutta from the list`,
  });

  let debounceTimer;

  // Debounced input handler
  browser.omnibox.onInputChanged.addListener((text, addSuggestions) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      handleInput(text, addSuggestions);
    }, 300); // Adjust the delay as needed
  });

  function handleInput(text, addSuggestions) {
    const lowerCaseText = text.toLowerCase();

    if (text.startsWith("sc ")) {
      const searchQuery = text.slice(3); // remove the 'sc ' prefix
      addSuggestions([
        {
          content: `${SEARCH_URL}?query=${searchQuery}`, // Full search URL
          description: `Search SuttaCentral.net for "${searchQuery}"`,
        },
      ]);
    } else {
      // Suggest matching suttas from the preprocessed list
      const suggestions = processedSuttas
        .filter(sutta => sutta.title.includes(lowerCaseText) || sutta.id.includes(lowerCaseText))
        .slice(0, 10) // Limit to 10 suggestions for performance
        .map(sutta => {
          const [title, id] = sutta.original.split(" | ");
          return {
            content: id,
            description: `${title} (${id})`,
          };
        });

      addSuggestions(suggestions);
    }
  }

  // Handle the selection or pressing enter to construct the correct URL
  browser.omnibox.onInputEntered.addListener((text, disposition) => {
    let url;

    if (text.startsWith("sc ")) {
      const searchQuery = text.slice(3); // remove 'sc ' prefix
      url = `${SEARCH_URL}?query=${searchQuery}`;
    } else {
      // Check if input matches a sutta
      const matchedSutta = processedSuttas.find(sutta => sutta.title.includes(text.toLowerCase()) || sutta.id.includes(text.toLowerCase()));
      if (matchedSutta) {
        url = `https://suttacentral.net/${matchedSutta.id}/en/sujato`;
      } else {
        // Otherwise, default to a search
        url = `${SEARCH_URL}?query=${text}`;
      }
    }

    switch (disposition) {
      case "currentTab":
        browser.tabs.update({ url });
        break;
      case "newForegroundTab":
        browser.tabs.create({ url });
        break;
      case "newBackgroundTab":
        browser.tabs.create({ url, active: false });
        break;
    }
  });
}
