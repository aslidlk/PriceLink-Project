const API_URL = "http://127.0.0.1:5001/api";

let allProducts = [];

/* =======================
   LOGIN
======================= */
async function handleLogin(event) {
    if (event) event.preventDefault();

    const username = document.getElementById("username")?.value;
    const password = document.getElementById("password")?.value;
    const errorDiv = document.getElementById("login-error");

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            localStorage.setItem("token", data.token);
            window.location.href = data.redirect || "dashboard.html";
        } else {
            if (errorDiv) {
                errorDiv.innerText = data.message || "Login failed.";
                errorDiv.style.display = "block";
            } else {
                alert(data.message || "Login failed.");
            }
        }
    } catch (err) {
        console.error("Login hatası:", err);
        alert("Sunucuya bağlanılamadı!");
    }
}

/* =======================
   PAGE LOAD
======================= */
document.addEventListener("DOMContentLoaded", () => {
    if (
        document.getElementById("product-table-body") ||
        document.querySelector(".product-table tbody") ||
        document.querySelector("#product-table tbody")
    ) {
        fetchAndRenderProducts();
        setupSearch();
    }
});

/* =======================
   FETCH PRODUCTS
======================= */
async function fetchAndRenderProducts() {
    const tableBody =
        document.getElementById("product-table-body") ||
        document.querySelector(".product-table tbody") ||
        document.querySelector("#product-table tbody");

    if (!tableBody) return;

    try {
        const response = await fetch(`${API_URL}/products`);
        const text = await response.text();

        let products;

        try {
            products = JSON.parse(text);
        } catch {
            console.error("Backend JSON dönmedi. Gelen cevap:", text);
            throw new Error("Backend JSON dönmedi. API_URL yanlış olabilir.");
        }

        if (!response.ok) {
            throw new Error(products.message || products.error || "Products API error");
        }

        allProducts = Array.isArray(products) ? products : [];

        renderProducts(allProducts);
        populateCategoryFilter(allProducts);

        console.log("✅ Ürünler başarıyla çekildi.");
    } catch (err) {
        console.error("❌ Ürün çekme hatası:", err);
        tableBody.innerHTML = `<tr><td colspan="7">Failed to load products.</td></tr>`;
    }
}

/* =======================
   RENDER PRODUCTS
======================= */
function renderProducts(products) {
    const tableBody =
        document.getElementById("product-table-body") ||
        document.querySelector(".product-table tbody") ||
        document.querySelector("#product-table tbody");

    if (!tableBody) return;

    tableBody.innerHTML = "";

    if (!Array.isArray(products) || products.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7">No products found.</td></tr>`;
        return;
    }

    products.forEach((p) => {
        const productName = p.title || p.name || "Unknown Product";
        const sku = p.product_id || p.sku || "N/A";
        const category = p.category || "General";
        const price = getProductPrice(p);
        const tagId = p.linkedTagId || "Not linked";
        const storeText = getStoreText(p);

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${sku}</td>
            <td>${productName}</td>
            <td><span class="badge yellow">${category}</span></td>
            <td id="price-${p._id}"><strong>₺${Number(price).toFixed(2)}</strong></td>
            <td>${storeText}</td>
            <td>${tagId}</td>
            <td></td>
        `;

        const actionCell = row.querySelector("td:last-child");

        const editButton = document.createElement("button");
        editButton.className = "btn btn-small edit btn-edit";
        editButton.innerText = "Edit";

        editButton.addEventListener("click", () => {
            fillForm(p._id, productName, price, tagId, sku, category, storeText);
        });

        const deleteButton = document.createElement("button");
        deleteButton.className = "btn btn-small delete";
        deleteButton.innerText = "Delete";
        deleteButton.style.marginLeft = "8px";

        deleteButton.addEventListener("click", async () => {
            const confirmDelete = confirm(`Delete "${productName}"?`);
            if (!confirmDelete) return;

            try {
                const response = await fetch(`${API_URL}/products/${p._id}`, {
                    method: "DELETE"
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.message || "Delete failed.");
                }

                alert("Product deleted successfully!");
                fetchAndRenderProducts();
            } catch (err) {
                console.error("❌ Delete error:", err);
                alert("Failed to delete product.");
            }
        });

        actionCell.appendChild(editButton);
        actionCell.appendChild(deleteButton);

        tableBody.appendChild(row);
    });
}

/* =======================
   HELPERS
======================= */
function getProductPrice(product) {
    if (
        product.online_price &&
        typeof product.online_price === "object" &&
        product.online_price.current !== undefined
    ) {
        return product.online_price.current;
    }

    if (typeof product.online_price === "number") {
        return product.online_price;
    }

    if (typeof product.price === "number") {
        return product.price;
    }

    return 0;
}

function getStoreText(product) {
    const stores = product.ankara_physical_stores;

    if (Array.isArray(stores) && stores.length > 0) {
        const firstStore = stores[0];

        if (typeof firstStore === "string") {
            return firstStore;
        }

        if (typeof firstStore === "object" && firstStore !== null) {
            return firstStore.branch || firstStore.name || firstStore.location || "Store";
        }
    }

    return product.store_location || "Store";
}

/* =======================
   FORM FILL
======================= */
function fillForm(id, name, price, tag, sku, category, storeText) {
    const nameInput = document.getElementById("p-name");
    if (!nameInput) return;

    nameInput.value = name || "";
    nameInput.dataset.currentId = id || "";

    const priceInput = document.getElementById("p-price");
    const tagInput = document.getElementById("p-tag");
    const skuInput = document.getElementById("p-sku");
    const categoryInput = document.getElementById("p-cat");
    const locationInput = document.getElementById("p-loc");

    if (priceInput) priceInput.value = price || 0;
    if (tagInput) tagInput.value = tag === "Not linked" ? "" : tag || "";
    if (skuInput) skuInput.value = sku === "N/A" ? "" : sku || "";
    if (categoryInput) categoryInput.value = category || "General";
    if (locationInput) locationInput.value = storeText || "Store";

    const title = document.getElementById("product-form-title");
    const saveButton = document.getElementById("save-product-btn");

    if (title) title.innerText = "Edit Product Details";
    if (saveButton) saveButton.innerText = "Save Changes";

    const scrollTarget =
        document.getElementById("product-form-title") ||
        document.querySelector(".panel:last-child");

    if (scrollTarget) {
        scrollTarget.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    }
}

/* =======================
   SAVE PRODUCT
======================= */
async function handleSaveChanges() {
    const nameInput = document.getElementById("p-name");
    if (!nameInput) return;

    const id = nameInput.dataset.currentId;

    const title = document.getElementById("p-name")?.value.trim();
    const product_id = document.getElementById("p-sku")?.value.trim();
    const priceValue = document.getElementById("p-price")?.value;
    const linkedTagId = document.getElementById("p-tag")?.value.trim();
    const category = document.getElementById("p-cat")?.value.trim();
    const storeLocation = document.getElementById("p-loc")?.value.trim();

    if (!title || !product_id) {
        alert("Product Name and SKU / Barcode are required.");
        return;
    }

    const payload = {
        title,
        product_id,
        price: Number(priceValue) || 0,
        linkedTagId: linkedTagId || null,
        category: category || "General",
        location: storeLocation || "Store",
        department: "H&M"
    };

    try {
        const url = id ? `${API_URL}/products/${id}` : `${API_URL}/products`;
        const method = id ? "PUT" : "POST";

        const response = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const text = await response.text();

        let result;

        try {
            result = JSON.parse(text);
        } catch {
            console.error("JSON olmayan cevap:", text);
            throw new Error("Backend JSON dönmedi. Yanlış adrese istek gidiyor olabilir.");
        }

        if (!response.ok) {
            throw new Error(result.message || result.error || "Operation failed.");
        }

        alert(id ? "Product updated successfully!" : "Product added successfully!");

        const priceElement = document.getElementById(`price-${id}`);
        if (priceElement) {
            priceElement.innerHTML = `<strong>₺${Number(priceValue).toFixed(2)}</strong>`;
        }

        resetForm();
        fetchAndRenderProducts();
    } catch (err) {
        console.error("❌ Save error:", err);
        alert("Error: " + err.message);
    }
}

/* =======================
   RESET FORM
======================= */
function resetForm() {
    const nameInput = document.getElementById("p-name");
    if (!nameInput) return;

    nameInput.value = "";
    nameInput.dataset.currentId = "";

    const priceInput = document.getElementById("p-price");
    const tagInput = document.getElementById("p-tag");
    const skuInput = document.getElementById("p-sku");
    const categoryInput = document.getElementById("p-cat");
    const locationInput = document.getElementById("p-loc");

    if (priceInput) priceInput.value = "";
    if (tagInput) tagInput.value = "";
    if (skuInput) skuInput.value = "";
    if (categoryInput) categoryInput.value = "";
    if (locationInput) locationInput.value = "";

    const title = document.getElementById("product-form-title");
    const saveButton = document.getElementById("save-product-btn");

    if (title) title.innerText = "Add / Edit Product";
    if (saveButton) saveButton.innerText = "Save Product";
}

/* =======================
   SEARCH & CATEGORY FILTER
======================= */
function setupSearch() {
    const searchInput = document.getElementById("search-input");
    const categoryFilter = document.getElementById("category-filter");

    if (searchInput) {
        searchInput.addEventListener("input", applyFilters);
    }

    if (categoryFilter) {
        categoryFilter.addEventListener("change", applyFilters);
    }
}

function applyFilters() {
    const searchTerm = document.getElementById("search-input")?.value.toLowerCase() || "";
    const selectedCategory = document.getElementById("category-filter")?.value || "all";

    const filtered = allProducts.filter((p) => {
        const name = (p.title || p.name || "").toLowerCase();
        const sku = (p.product_id || p.sku || "").toLowerCase();
        const category = p.category || "General";

        return (
            (name.includes(searchTerm) || sku.includes(searchTerm)) &&
            (selectedCategory === "all" || category === selectedCategory)
        );
    });

    renderProducts(filtered);
}

function populateCategoryFilter(products) {
    const filter = document.getElementById("category-filter");
    if (!filter) return;

    const currentValue = filter.value || "all";

    const categories = [
        ...new Set(products.map((p) => p.category || "General"))
    ];

    filter.innerHTML = `<option value="all">All Categories</option>`;

    categories.forEach((cat) => {
        const option = document.createElement("option");
        option.value = cat;
        option.innerText = cat;
        filter.appendChild(option);
    });

    filter.value = currentValue;
}

/* =======================
   GLOBAL FUNCTIONS
======================= */
window.handleLogin = handleLogin;
window.fillForm = fillForm;
window.handleSaveChanges = handleSaveChanges;
window.fetchAndRenderProducts = fetchAndRenderProducts;
window.resetForm = resetForm;