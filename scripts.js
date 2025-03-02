document.addEventListener("DOMContentLoaded", async () => {
	const CACHE_TTL = 15 * 60 * 1000;
	const CLASS_COLORS = {
		Sorcerer: "#992E2E",
		Wizard: "#2A50A1",
		Druid: "#7A853B",
		Ranger: "#507F62",
		Rogue: "#555752",
		Artificer: "#ee8600",
		Bard: "#AB6DAC",
		Cleric: "#ffae00",
		Paladin: "#9e9e9e",
		Warlock: "#5f1c8a",
	};

	let allSpells = [];
	let filteredSpells = [];
	let templateCache = null;
	let abortController = new AbortController();

	const dom = {
		classSelect: document.getElementById("classSelect"),
		levelSelect: document.getElementById("levelSelect"),
		schoolSelect: document.getElementById("schoolSelect"),
		sortSelect: document.getElementById("sortSelect"),
		spellContainer: document.getElementById("spellContainer"),
		selectAllButton: document.getElementById("selectAllButton"),
		clearAllButton: document.getElementById("clearAllButton"),
		printFrontButton: document.getElementById("printFrontButton"),
		printBackButton: document.getElementById("printBackButton"),
		flipCardsButton: document.getElementById("flipCardsButton"),
	};

	// Utility function to debounce events
	const debounce = (fn, delay) => {
		let timeout;
		return (...args) => {
			clearTimeout(timeout);
			timeout = setTimeout(() => fn(...args), delay);
		};
	};

	// Function to sanitize HTML
	function sanitizeHTML(html) {
		const tempDiv = document.createElement("div");
		tempDiv.innerHTML = html;
		tempDiv
			.querySelectorAll("script, iframe, object, embed")
			.forEach((el) => el.remove());
		return tempDiv.innerHTML;
	}

	// Load spell data
	async function loadSpellData() {
		const cacheKey = "spellData";
		const cached = localStorage.getItem(cacheKey);
		if (cached) {
			const { data, timestamp } = JSON.parse(cached);
			if (Date.now() - timestamp < CACHE_TTL) return data;
		}

		try {
			const response = await fetch("spells.json", {
				signal: abortController.signal,
			});
			if (!response.ok) throw new Error("Failed to fetch spell data.");
			const data = await response.json();
			if (!data.spells || !Array.isArray(data.spells))
				throw new Error("Invalid spells.json format.");
			localStorage.setItem(
				cacheKey,
				JSON.stringify({ data: data.spells, timestamp: Date.now() })
			);
			return data.spells;
		} catch (error) {
			console.error("Error loading spells:", error);
			return [];
		}
	}

	// Populate dropdowns (Fix for missing classes & schools)
	function populateDropdowns() {
		const uniqueClasses = new Set();
		const uniqueSchools = new Set();

		allSpells.forEach((spell) => {
			spell.classes?.forEach((cls) => uniqueClasses.add(cls));
			uniqueSchools.add(spell.school);
		});

		// Populate Class Select
		dom.classSelect.innerHTML = `<option value="">All Classes</option>`;
		uniqueClasses.forEach((cls) =>
			dom.classSelect.append(new Option(cls, cls))
		);

		// Populate School Select
		dom.schoolSelect.innerHTML = `<option value="">All Schools</option>`;
		uniqueSchools.forEach((school) =>
			dom.schoolSelect.append(new Option(school, school))
		);
	}

	// Filter & Sort Spells (Reintroduced this function!)
	function filterAndSortSpells() {
		const selectedClass = dom.classSelect.value;
		const selectedLevels = [...dom.levelSelect.selectedOptions].map(
			(o) => o.value
		);
		const selectedSchools = [...dom.schoolSelect.selectedOptions].map(
			(o) => o.value
		);
		const sortValue = dom.sortSelect.value;

		return allSpells
			.filter(
				(spell) =>
					(!selectedClass || spell.classes?.includes(selectedClass)) &&
					(selectedLevels.length === 0 ||
						selectedLevels.includes(spell.level.toString())) &&
					(selectedSchools.length === 0 ||
						selectedSchools.includes(spell.school))
			)
			.sort((a, b) => {
				switch (sortValue) {
					case "school":
						return a.school.localeCompare(b.school);
					case "levelAsc":
						return a.level - b.level;
					case "levelDesc":
						return b.level - a.level;
					default:
						return 0;
				}
			});
	}

	// Render Spells
	async function renderSpells() {
		dom.spellContainer.innerHTML =
			'<div class="loading-state">Loading spells...</div>';
		const fragment = document.createDocumentFragment();
		const cards = await Promise.all(
			filteredSpells.map((spell) =>
				createSpellCard(spell, dom.classSelect.value)
			)
		);
		fragment.append(...cards);
		dom.spellContainer.replaceChildren(fragment);
	}

	// Flip selected cards
	function flipSelectedCards() {
		document.querySelectorAll(".spell-card.selected").forEach((card) => {
			card.classList.toggle("flipped");
		});
	}

	// Event Listeners
	dom.selectAllButton.addEventListener("click", () => {
		document.querySelectorAll(".select-checkbox").forEach((checkbox) => {
			checkbox.checked = true;
			checkbox.dispatchEvent(new Event("change", { bubbles: true }));
		});
	});

	// NEW: Clear all selected cards
	dom.clearAllButton.addEventListener("click", () => {
		document.querySelectorAll(".spell-card.selected").forEach((card) => {
			card.classList.remove("selected");
			card.querySelector(".select-checkbox").checked = false;
		});
	});

	dom.printFrontButton.addEventListener("click", () =>
		printSelectedCards(false)
	);
	dom.printBackButton.addEventListener("click", () => printSelectedCards(true));
	dom.flipCardsButton.addEventListener("click", flipSelectedCards);

	// Apply debounce to dropdown changes for performance
	document.querySelectorAll(".filter-select").forEach((select) => {
		select.addEventListener(
			"change",
			debounce(() => {
				filteredSpells = filterAndSortSpells();
				renderSpells();
			}, 300)
		);
	});





    async function createSpellCard(spell, selectedClass) {
        const card = document.createElement("div");
        card.className = "spell-card";

        try {
            const currentClass = selectedClass || spell.classes?.[0] || "Unknown";
            const template = await fetchTemplate();
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = template;

            const content = tempDiv
                .querySelector("template")
                .content.cloneNode(true);

            // Populate template elements
            content.querySelector(".spell-name").textContent = spell.name;
            content.querySelector(".spell-casting-time .si-txt").textContent =
                spell.casting_time;
            content.querySelector(".spell-components .si-txt").textContent =
                spell.components;
            content.querySelector(".spell-range .si-txt").textContent =
                spell.range;
            content.querySelector(".spell-duration .si-txt").textContent =
                spell.duration;

            content.querySelector(".desc").innerHTML = sanitizeHTML(
                spell.description
            );
            content.querySelector(
                ".spell-level"
            ).textContent = Level ${spell.level} ${spell.school};
            content.querySelector(".classes .si-txt").textContent =
                spell.classes.join(", ");

            content.querySelector(".spell-class").textContent = currentClass;

            content.querySelector(".back-spell-level").innerHTML = sanitizeHTML(
                spell.level
            );

            //sanitize HTML just in case...
            function sanitizeHTML(html) {
                const tempDiv = document.createElement("div");
                tempDiv.innerHTML = html;

                // Remove potentially dangerous elements
                const scripts = tempDiv.querySelectorAll(
                    "script, iframe, object, embed"
                );
                scripts.forEach((el) => el.remove());

                return tempDiv.innerHTML;
            }

            // Set class-specific styling
            const images = content.querySelectorAll(".class-image");
            images.forEach((img) => {
                img.src = img/${currentClass.toLowerCase()}.png;
                img.alt = currentClass;
            });

            card.style.setProperty(
                "--classColor",
                CLASS_COLORS[currentClass] || "gray"
            );

            // Add checkbox functionality
            const checkbox = content.querySelector(".select-checkbox");

            // Make the entire card clickable to toggle the checkbox
            card.addEventListener("click", (event) => {
                // Prevent clicks inside the checkbox from double-triggering
                if (event.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                    card.classList.toggle("selected", checkbox.checked);
                    card.setAttribute("aria-checked", checkbox.checked);
                }
            });

            // Ensure direct clicks on the checkbox also trigger card selection styling
            checkbox.addEventListener("change", (e) => {
                card.classList.toggle("selected", e.target.checked);
                card.setAttribute("aria-checked", e.target.checked);
            });

            card.appendChild(content);
            return card;
        } catch (error) {
            console.error("Card creation failed:", error);
            const fallback = document.createElement("div");
            fallback.className = "error-card";
            fallback.textContent = spell.name;
            return fallback;
        }
    }


    function showNotification(message) {
        const notification = document.getElementById("notification");
        notification.textContent = message;
        notification.classList.add("show");
    
        setTimeout(() => {
            notification.classList.remove("show");
        }, 2000); // Hide after 2 seconds
    }
    


	// ✅ Initialize everything (Fixes "Loading..." issue)
	allSpells = await loadSpellData();
	if (allSpells.length === 0) {
		dom.spellContainer.innerHTML =
			'<div class="error">Failed to load spells. Check your <code>spells.json</code> file.</div>';
		return;
	}
	populateDropdowns();
	filteredSpells = filterAndSortSpells();
	await renderSpells();
});
