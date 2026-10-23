const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  "https://activities.go2andaman.com/api";

async function request(url, options = {}) {
  const response = await fetch(`${API_BASE}/v1${url}`, options);

  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }

  const json = await response.json();

  if (!json.success) {
    throw new Error(json.message || "Request failed");
  }

  return json;
}

export async function getProduct(slug) {
  const response = await request(
    `/products/app/products-list/${slug}`
  );

  return response.data;
}

export async function getProducts(params = {}) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      if (Array.isArray(value)) {
        value.forEach((v) => search.append(key, v));
      } else {
        search.append(key, value);
      }
    }
  });

  const response = await request(
    `/products/app/products-list?${search.toString()}`
  );

  return response.data.flatMap((product) => {
    if (!product.locations?.length) {
      return [{ ...product, locations: [] }];
    }

    return product.locations.map((location) => ({
      ...product,
      locations: [location],
    }));
  });
}