import { writable, type Writable } from "svelte/store";
import { isProduction } from "./env";

export const theme: Writable<string> = writable(isProduction() ? "dark" : "system");
export const darkMode: Writable<boolean> = writable(false)

document.documentElement.classList.contains("dark") && darkMode.set(true);

// const observer = new MutationObserver((mutations) => {
//     mutations.forEach(mutation => {
//         if (mutation.attributeName === "class") {
//             if(isProduction()) return darkMode.set(true);
//             const classList = document.documentElement.classList;
//             if (classList.contains("dark")) {
//                 darkMode.set(true);
//             } else {
//                 darkMode.set(false);
//             }
//         }
//     });
// });
// observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });