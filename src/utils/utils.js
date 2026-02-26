export const formatString = (str) => {
    const parts = str.split("-");

    const filtered = parts.filter(part => {
        const slashCount = (part.match(/\//g) || []).length;
        return slashCount < 3;  // remove only if 3 or more slashes
    });

    return filtered.join("-");
};
