import api from "../service/baseUrl";

export function createPath(payload: FormData) {
  return api.post("/path/create", payload, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
}
