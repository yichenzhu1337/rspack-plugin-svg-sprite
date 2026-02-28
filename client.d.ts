declare module '*.svg' {
  const symbol: {
    /** The symbol ID inside the sprite (e.g., "icon-home") */
    id: string;
    /** The original SVG viewBox attribute (e.g., "0 0 24 24") */
    viewBox: string;
    /** Fragment reference (inline: "#icon-home") or full URL (extract: "/sprites/icons.svg#icon-home") */
    url: string;
    /** Raw `<symbol>` markup */
    content: string;
  };
  export default symbol;
}
