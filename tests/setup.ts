// The router reads PORT at import; tests never bind it.
process.env.PORT = process.env.PORT || "65000";
