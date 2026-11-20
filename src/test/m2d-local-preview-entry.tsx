import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../styles.css";
import { LocalOwnerReviewWorkspace } from "./m2d-owner-review-workspace";

const root = document.getElementById("root");
if (!root) throw new Error("local_preview_mount_missing");
createRoot(root).render(<StrictMode><LocalOwnerReviewWorkspace/></StrictMode>);
