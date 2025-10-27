const test = fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
        // obviously this API key has been rotated.
        // i forgot about this before public-ing the repo lol
        Authorization: "Bearer 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",
        "Content-Type": "application/json"
    },
    body: JSON.stringify({
        model: "meta-llama/llama-3.3-70b-instruct:free",
        messages: [
            {
                role: "user",
                content: "What is the meaning of life?"
            }
        ]
    })
});

test.then((response) => {
    if (!response.ok) {
        console.error("Error:", response.status, response.statusText);
        return;
    }
    return response.json();
})
    .then((data) => {
        console.log("Response data:", data);
    })
    .catch((error) => {
        console.error("Fetch error:", error);
    });
