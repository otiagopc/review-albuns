export default async function handler(req, res) {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({
            error: {
                status: 400,
                message: "A URL do álbum do Spotify é obrigatória."
            }
        });
    }

    const match = url.match(/album\/([a-zA-Z0-9]+)/);
    const albumId = match ? match[1] : null;

    if (!albumId) {
        return res.status(400).json({
            error: {
                status: 400,
                message: "A URL do álbum do Spotify é inválida ou não pôde ser analisada."
            }
        });
    }

    // Obtenção do token de acesso temporário da API do Spotify (autenticação Client Credentials)
    let tokenRes;
    try {
        tokenRes = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: {
                Authorization:
                    "Basic " +
                    Buffer.from(
                        process.env.CLIENT_ID + ":" + process.env.CLIENT_SECRET,
                    ).toString("base64"),
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: "grant_type=client_credentials",
        });
    } catch (err) {
        return res.status(500).json({
            error: {
                status: 500,
                message: "Falha ao se conectar com os servidores do Spotify. Verifique sua conexão de rede."
            }
        });
    }

    let tokenData;
    try {
        tokenData = await tokenRes.json();
    } catch (err) {
        return res.status(500).json({
            error: {
                status: 500,
                message: "Resposta inválida (não-JSON) do serviço de autenticação do Spotify."
            }
        });
    }
    const token = tokenData.access_token;

    if (!token) {
        return res.status(401).json({
            error: {
                status: 401,
                message: "Não foi possível obter o token de acesso do Spotify. Verifique se as credenciais (CLIENT_ID e CLIENT_SECRET) no arquivo .env.local são válidas e se o servidor local foi reiniciado."
            }
        });
    }

    // Requisição das informações detalhadas do álbum (títulos, faixas, durações e capas) no Spotify
    const albumRes = await fetch(
        `https://api.spotify.com/v1/albums/${albumId}`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        },
    );

    if (!albumRes.ok) {
        let errorData = {};
        try {
            errorData = await albumRes.json();
        } catch (err) {
            // Ignora erro de JSON e utiliza a mensagem de erro padrão abaixo
        }
        return res.status(albumRes.status).json({
            error: {
                status: albumRes.status,
                message: errorData.error?.message || "Erro ao buscar dados do álbum no Spotify."
            }
        });
    }

    let albumData;
    try {
        albumData = await albumRes.json();
    } catch (err) {
        return res.status(500).json({
            error: {
                status: 500,
                message: "Resposta inválida (não-JSON) recebida da API do Spotify."
            }
        });
    }

    res.status(200).json(albumData);
}
