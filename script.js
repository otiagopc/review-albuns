
// variaveis de estado e globais

function getDefaultNota() {
    return getRatingScale() === "5" ? 0 : 1;
}

// verifica se a faixa foi realmente avaliada pelo usuario (ignora valor padrao: 0 na escala 5 estrelas e 1 na escala 9 estrelas)
function isTrackAvaliada(track) {
    if (!track) return false;
    const scale = getRatingScale();
    const defaultNota = scale === "5" ? 0 : 1;
    return (track.nota || 0) > defaultNota;
}

let estado = {
    id: "",
    album: "",
    artista: "",
    ano: "",
    capa: "",
    link: "",
    albumNota: getDefaultNota(),
    albumNotaCalculada: 0,
    calcMode: "",
    tracks: [],
    data: "",
    anotacoes: "",
};
let activeBg = 1;
let currentCapa = "";
let librarySortDesc = true;
let isFirstLoad = false;

// estado vazio para resetar o editor
function getEmptyState() {
    return {
        id: "",
        album: "",
        artista: "",
        ano: "",
        capa: "",
        link: "",
        albumNota: getDefaultNota(),
        albumNotaCalculada: 0,
        calcMode: "",
        tracks: [],
        data: "",
        listened_at: "",
        anotacoes: "",
    };
}

// funcoes auxiliares

// data de hoje formatada (DD/MM/AAAA)
function getDataHoje() {
    const hoje = new Date();
    const d = String(hoje.getDate()).padStart(2, "0");
    const m = String(hoje.getMonth() + 1).padStart(2, "0");
    const y = hoje.getFullYear();
    return `${d}/${m}/${y}`;
}

// converte DD/MM/AAAA para YYYY-MM-DD
function formatarParaInputDate(dataStr) {
    if (!dataStr) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) return dataStr;
    const parts = dataStr.split("/");
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
    return "";
}

// converte YYYY-MM-DD para DD/MM/AAAA
function formatarDeInputDate(isoDateStr) {
    if (!isoDateStr) return "";
    const parts = isoDateStr.split("-");
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoDateStr;
}

// define data de audicao para a data atual
function definirDataAudicaoHoje() {
    const hoje = new Date();
    const y = hoje.getFullYear();
    const m = String(hoje.getMonth() + 1).padStart(2, "0");
    const d = String(hoje.getDate()).padStart(2, "0");
    const isoDate = `${y}-${m}-${d}`;
    atualizarDataAudicao(isoDate);
}

// atualiza data de audicao no estado e salva rascunho
function atualizarDataAudicao(isoDate) {
    estado.listened_at = isoDate;
    const input = document.getElementById("review-listened-date");
    if (input) input.value = isoDate;
    autoSaveDraft();
}

// sufixo da escala ativa
function getMaxScoreLabel() {
    return getRatingScale() === "5" ? "/5" : "/9";
}

// salva rascunho automaticamente
function autoSaveDraft() {
    if (!estado.id) return;
    if (estado.isDraft) {
        let historico = getHistorico();
        const index = historico.findIndex((r) => r.id === estado.id);
        if (index !== -1) {
            historico[index] = { ...estado };
            salvarHistorico(historico);
        }
    }
}

// vai para o editor com o album
function navegarParaReview(rev, clonar = false) {
    if (!rev || !rev.album) {
        desselecionarAlbum();
        return;
    }
    estado = clonar ? { ...rev } : rev;
    switchView("reviews");
    isFirstLoad = true;
    render();
    if (!estado.ano && (estado.id || estado.link)) {
        buscarAnoAlbumSeNecessario();
    }
}

// desseleciona o album e volta para a biblioteca
function desselecionarAlbum() {
    autoSaveDraft();
    estado = getEmptyState();
    isFirstLoad = true;
    render();
    if (typeof esconderHistoryTooltip === "function") {
        esconderHistoryTooltip();
    }
    switchView("library");
}

// clique no item "biblioteca" da barra lateral
function handleNavLibraryClick(e) {
    if (e && e.preventDefault) e.preventDefault();
    const reviewsView = document.getElementById('view-reviews');
    const isReviewOpen = reviewsView && reviewsView.style.display !== 'none' && estado.album;
    if (isReviewOpen) {
        desselecionarAlbum();
    } else if (estado.album) {
        switchView('reviews');
    } else {
        switchView('library');
    }
}

// deleta review sem confirmar
function deletarReviewSemConfirmacao(revId, revAlbum, revArtista) {
    const origHistorico = getHistorico();
    const origIndex = origHistorico.findIndex(r => r.id === revId || (!r.id && r.album === revAlbum && r.artista === revArtista));
    if (origIndex !== -1) {
        origHistorico.splice(origIndex, 1);
        salvarHistorico(origHistorico);
    }
    if (estado.id === revId || (!estado.id && revAlbum && estado.album === revAlbum && revArtista && estado.artista === revArtista)) {
        desselecionarAlbum();
    }
}

// deleta a review atualmente aberta no editor com confirmacao
function deletarReviewAberta() {
    if (!estado.album && !estado.id) return;
    const nome = estado.album || "esta review";
    if (confirm(`deseja realmente excluir a review de "${nome}"?`)) {
        deletarReviewSemConfirmacao(estado.id, estado.album, estado.artista);
        carregarHistorico();
        if (typeof recalcularDimensoesEditorSidebar === "function") {
            recalcularDimensoesEditorSidebar();
        }
    }
}

// converte tempo e duracao

// ms para MM:SS
function formatarTempo(ms) {
    if (!ms) return "";
    const totalSegundos = Math.floor(ms / 1000);
    const minutos = Math.floor(totalSegundos / 60);
    const segundos = totalSegundos % 60;
    return `${minutos}:${segundos.toString().padStart(2, "0")}`;
}

// ms para duracao no editor
function formatarTempoTotal(ms) {
    if (!ms) return "";
    const totalSegundos = Math.floor(ms / 1000);
    const minutos = Math.floor(totalSegundos / 60);
    const horas = Math.floor(minutos / 60);
    const minsRestantes = minutos % 60;

    if (horas > 0) {
        return `${horas}h ${minsRestantes}min`;
    }
    return `${minutos} min`;
}

// ms para duracao no dashboard
function formatarTempoTotalDashboard(ms) {
    if (!ms) return "0 min";
    const totalSegundos = Math.floor(ms / 1000);
    const minutos = Math.floor(totalSegundos / 60);
    const horas = Math.floor(minutos / 60);
    const minsRestantes = minutos % 60;

    if (horas >= 24) {
        const dias = Math.floor(horas / 24);
        const horasRestantes = horas % 24;
        if (horasRestantes > 0) {
            return `${dias}d ${horasRestantes}h`;
        }
        return `${dias}d`;
    }
    if (horas > 0) {
        return `${horas}h ${minsRestantes}m`;
    }
    return `${minutos} min`;
}

// duracao total em ms
function calcularDuracaoTotal(tracks) {
    if (!tracks || !Array.isArray(tracks)) return 0;
    return tracks.reduce((sum, t) => sum + (t.duration_ms || 0), 0);
}

// componentes visuais

// controla tela de carregamento
function setLoading(isLoading) {
    const loading = document.getElementById("loading");
    const placeholder = document.getElementById("placeholder");
    const header = document.getElementById("header");
    const tracksDiv = document.getElementById("tracks");
    const actionsDiv = document.getElementById("album-actions");
    const notesContainer = document.getElementById("notes-container");

    if (isLoading) {
        if (loading) loading.style.display = "flex";
        if (placeholder) placeholder.style.display = "none";
        if (header) header.style.display = "none";
        if (tracksDiv) tracksDiv.style.display = "none";
        if (actionsDiv) actionsDiv.style.display = "none";
        if (notesContainer) notesContainer.style.display = "none";
    } else {
        if (loading) loading.style.display = "none";
    }
}

// atualiza fundo com a capa
function atualizarFundo(novaCapa) {
    if (novaCapa === currentCapa) return;

    if (!novaCapa) {
        document.body.classList.remove("bg-active-1", "bg-active-2");
        currentCapa = "";
        return;
    }

    activeBg = activeBg === 1 ? 2 : 1;
    document.body.style.setProperty(`--bg-${activeBg}`, `url('${novaCapa}')`);

    if (activeBg === 1) {
        document.body.classList.add("bg-active-1");
        document.body.classList.remove("bg-active-2");
    } else {
        document.body.classList.add("bg-active-2");
        document.body.classList.remove("bg-active-1");
    }

    currentCapa = novaCapa;
}

// estrelas interativas

// barra de estrelas com toque e arraste
function criarEstrelas(container, valorAtual, onClick, isAlbum = false) {
    container.innerHTML = "";
    const stars = [];
    const scale = getRatingScale();
    const maxStars = scale === "5" ? 5 : 9;
    const minStars = scale === "5" ? 0 : 1;
    const permiteMeia = (scale === "5") || !isAlbum;

    for (let i = 1; i <= maxStars; i++) {
        const star = document.createElement("span");
        star.className = "star";
        stars.push(star);
        container.appendChild(star);
    }

    function pintar(valor, isHover = false) {
        stars.forEach((star, index) => {
            star.classList.remove("full", "half", "hover");
            const i = index + 1;

            if (valor >= i) star.classList.add("full");
            else if (permiteMeia && valor >= i - 0.5) star.classList.add("half");

            if (isHover && i <= Math.ceil(valor)) {
                star.classList.add("hover");
            }
        });
    }

    pintar(valorAtual, false);

    function calcularValor(clientX) {
        if (stars.length === 0) return minStars;
        const firstRect = stars[0].getBoundingClientRect();
        const lastRect = stars[stars.length - 1].getBoundingClientRect();

        if (clientX < firstRect.left) return minStars;
        if (clientX > lastRect.right) return maxStars;

        for (let idx = 0; idx < stars.length; idx++) {
            const rect = stars[idx].getBoundingClientRect();
            if (clientX >= rect.left && clientX <= rect.right) {
                if (!permiteMeia) {
                    return Math.max(minStars, idx + 1);
                } else {
                    const relativeX = clientX - rect.left;
                    return Math.max(minStars, relativeX < rect.width / 2 ? idx + 0.5 : idx + 1);
                }
            }
        }

        let closestIdx = 0;
        let minDistance = Infinity;
        for (let idx = 0; idx < stars.length; idx++) {
            const rect = stars[idx].getBoundingClientRect();
            const starCenter = rect.left + rect.width / 2;
            const dist = Math.abs(clientX - starCenter);
            if (dist < minDistance) {
                minDistance = dist;
                closestIdx = idx;
            }
        }

        if (!permiteMeia) {
            return Math.max(minStars, closestIdx + 1);
        } else {
            const rect = stars[closestIdx].getBoundingClientRect();
            const relativeX = clientX - rect.left;
            return Math.max(minStars, relativeX < rect.width / 2 ? closestIdx + 0.5 : closestIdx + 1);
        }
    }

    container.style.touchAction = "none";
    container.style.userSelect = "none";
    container.style.webkitUserSelect = "none";

    let isDragging = false;
    let lastValue = valorAtual;

    container.onpointerdown = (e) => {
        if (e.target && e.target.closest('.crown-btn')) return;
        const firstRect = stars[0].getBoundingClientRect();
        const lastRect = stars[stars.length - 1].getBoundingClientRect();
        const starsTop = firstRect.top;
        const starsBottom = firstRect.bottom;
        if (e.clientX < firstRect.left || e.clientX > lastRect.right ||
            e.clientY < starsTop || e.clientY > starsBottom) return;
        if (e.button !== 0 && e.pointerType === "mouse") return;

        isDragging = true;
        container.setPointerCapture(e.pointerId);

        const val = calcularValor(e.clientX);
        lastValue = val;
        pintar(val, true);
    };

    container.onpointermove = (e) => {
        if (isDragging) {
            const val = calcularValor(e.clientX);
            lastValue = val;
            pintar(val, true);
        } else {
            const isOverCrown = e.target && e.target.closest('.crown-btn');
            const firstRect = stars[0].getBoundingClientRect();
            const lastRect = stars[stars.length - 1].getBoundingClientRect();

            if (isOverCrown || e.clientX < firstRect.left || e.clientX > lastRect.right) {
                pintar(valorAtual, false);
            } else {
                const val = calcularValor(e.clientX);
                pintar(val, true);
            }
        }
    };

    container.onpointerup = (e) => {
        if (isDragging) {
            container.releasePointerCapture(e.pointerId);
            isDragging = false;
            onClick(lastValue);
        }
    };

    container.onpointercancel = (e) => {
        if (isDragging) {
            container.releasePointerCapture(e.pointerId);
            isDragging = false;
            pintar(valorAtual, false);
        }
    };

    container.onpointerleave = () => {
        if (!isDragging) {
            pintar(valorAtual, false);
        }
    };
}

// integracao com a api

// busca album no spotify
async function gerar() {
    const url = document.getElementById("url").value.trim();
    if (!url) return alert("por favor cole um link valido do spotify!!!");

    setLoading(true);

    try {
        const res = await fetch(`/api/album?url=${encodeURIComponent(url)}`);
        const data = await res.json();

        if (!res.ok || data.error) {
            throw new Error(data.error?.message || "Erro desconhecido na API do Spotify");
        }

        const artistNames = data.artists.map((a) => a.name).join(", ");
        const releaseYear = data.release_date ? data.release_date.split("-")[0] : "";
        let historico = getHistorico();
        const reviewsDoMesmo = getReviewsDoMesmoAlbum(historico, data.name, artistNames, data.id);

        if (reviewsDoMesmo.length > 0) {
            // Carrega a review mais recente do album
            const maisRecente = reviewsDoMesmo[reviewsDoMesmo.length - 1];
            estado = { ...maisRecente };
            if (!estado.ano && releaseYear) {
                estado.ano = releaseYear;
                const idx = historico.findIndex(r => r.id === maisRecente.id);
                if (idx !== -1) {
                    historico[idx].ano = releaseYear;
                    salvarHistorico(historico);
                }
            }
        } else {
            const novoId = "rev_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
            estado = {
                id: novoId,
                spotifyId: data.id,
                album: data.name,
                artista: artistNames,
                ano: releaseYear,
                capa: data.images[0].url,
                link: data.external_urls.spotify,
                albumNota: getDefaultNota(),
                albumNotaCalculada: 0,
                calcMode: getAutoCalculateMode(),
                tracks: data.tracks.items.map((t) => ({
                    nome: t.name,
                    nota: getDefaultNota(),
                    fav: false,
                    duration_ms: t.duration_ms || 0,
                })),
                data: "",
                listened_at: new Date().toISOString().split("T")[0],
                anotacoes: "",
                isDraft: true,
                createdAt: Date.now()
            };
            historico.push({ ...estado });
            salvarHistorico(historico);
        }

        setLoading(false);
        navegarParaReview(estado);
    } catch (err) {
        setLoading(false);
        render();
        alert(`erro ao buscar album: ${err.message}. verifique o link ou se as credenciais da API do Spotify em .env.local estão configuradas corretamente.`);
        console.error(err);
    }
}

// reavaliacoes e historico do mesmo album

// retorna todas as avaliacoes salvas para um mesmo album ordenadas por data
function getReviewsDoMesmoAlbum(historico, album, artista, spotifyId) {
    if (!album) return [];
    const albLower = album.toLowerCase().trim();
    const artLower = (artista || "").toLowerCase().trim();

    return historico.filter(r => {
        if (spotifyId && r.spotifyId && r.spotifyId === spotifyId) return true;
        if (r.album && r.album.toLowerCase().trim() === albLower) {
            if (!artLower || !r.artista || r.artista.toLowerCase().trim() === artLower) return true;
        }
        return false;
    }).sort((a, b) => {
        const dateA = a.listened_at || (a.data ? getSortableDate(a.data) : 0) || a.createdAt || 0;
        const dateB = b.listened_at || (b.data ? getSortableDate(b.data) : 0) || b.createdAt || 0;
        return dateA < dateB ? -1 : (dateA > dateB ? 1 : 0);
    });
}

// inicia uma nova avaliacao para o mesmo album (reavaliacao)
function iniciarReavaliacao() {
    if (!estado.album) return;

    const querDuplicarNotas = confirm(
        `Deseja iniciar uma nova avaliação para "${estado.album}"?\n\n` +
        `• Clique em "OK" para usar suas notas anteriores como ponto de partida.\n` +
        `• Clique em "Cancelar" para iniciar uma avaliação limpa do zero.`
    );

    const novoId = "rev_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
    const hojeStr = getDataHoje();
    const hojeIso = new Date().toISOString().split("T")[0];

    const tracksCopia = (estado.tracks || []).map(t => ({
        nome: t.nome,
        nota: querDuplicarNotas ? t.nota : getDefaultNota(),
        fav: querDuplicarNotas ? !!t.fav : false,
        duration_ms: t.duration_ms || 0
    }));

    const novoEstado = {
        id: novoId,
        spotifyId: estado.spotifyId || estado.id,
        album: estado.album,
        artista: estado.artista,
        ano: estado.ano || "",
        capa: estado.capa || "",
        link: estado.link || "",
        albumNota: querDuplicarNotas ? estado.albumNota : getDefaultNota(),
        albumNotaCalculada: 0,
        calcMode: estado.calcMode || getAutoCalculateMode(),
        tracks: tracksCopia,
        data: hojeStr,
        listened_at: hojeIso,
        anotacoes: "",
        isDraft: true,
        createdAt: Date.now()
    };

    let historico = getHistorico();
    historico.push({ ...novoEstado });
    salvarHistorico(historico);

    navegarParaReview(novoEstado, true);
}

// renderiza o editor

// atualiza os dados dinamicos do painel lateral direito do editor (resumo, metricas e detalhes da avaliacao)
function atualizarPainelLateralReview() {
    const asideRight = document.getElementById("review-aside-right");
    if (!asideRight || !estado.album) return;

    // 1. Status da review (rascunho vs concluida)
    const statusBadge = document.getElementById("review-status-badge");
    const statusText = document.getElementById("review-status-text");
    if (statusBadge && statusText) {
        if (estado.isDraft) {
            statusBadge.className = "review-status-badge draft";
            statusText.textContent = "rascunho";
        } else {
            statusBadge.className = "review-status-badge saved";
            statusText.textContent = "concluída";
        }
    }

    // 2. Data de audicao
    const dateInput = document.getElementById("review-listened-date");
    if (dateInput) {
        if (!estado.listened_at) {
            estado.listened_at = formatarParaInputDate(estado.data) || new Date().toISOString().split("T")[0];
        }
        dateInput.value = estado.listened_at;
    }

    // 3. Comparativo: Media calculada das faixas vs Nota do album (com seletor interativo de modo)
    const tracksAvgEl = document.getElementById("detail-tracks-avg");
    const albumScoreEl = document.getElementById("detail-album-score");
    const btnTracksAvg = document.getElementById("btn-mode-tracks-avg");
    const btnAlbumManual = document.getElementById("btn-mode-album-manual");

    if (tracksAvgEl && albumScoreEl) {
        const tracks = estado.tracks || [];
        const ratedTracks = tracks.filter(isTrackAvaliada);
        let mediaTracks = 0;
        if (ratedTracks.length > 0) {
            const sum = ratedTracks.reduce((acc, t) => acc + (t.nota || 0), 0);
            mediaTracks = sum / ratedTracks.length;
        }
        const mediaScaled = aEscala(mediaTracks, true);
        const albumScoreScaled = aEscala(estado.albumNota || 0, true);
        const maxScore = getMaxScoreLabel();

        tracksAvgEl.textContent = `${mediaScaled.toFixed(1)}${maxScore}`;
        albumScoreEl.textContent = `${albumScoreScaled.toFixed(1)}${maxScore}`;

        const isSimples = isAlbumAutoCalc(estado);

        if (btnTracksAvg && btnAlbumManual) {
            if (isSimples) {
                btnTracksAvg.classList.add("active");
                btnAlbumManual.classList.remove("active");
                tracksAvgEl.classList.add("highlight");
                albumScoreEl.classList.remove("highlight");
            } else {
                btnTracksAvg.classList.remove("active");
                btnAlbumManual.classList.add("active");
                tracksAvgEl.classList.remove("highlight");
                albumScoreEl.classList.add("highlight");
            }
        }
    }

    // 4. Progresso de faixas avaliadas
    const progressTextEl = document.getElementById("detail-progress-text");
    const progressFillEl = document.getElementById("detail-progress-fill");
    if (progressTextEl && progressFillEl) {
        const total = estado.tracks ? estado.tracks.length : 0;
        const avaliadas = estado.tracks ? estado.tracks.filter(isTrackAvaliada).length : 0;
        const pct = total > 0 ? Math.round((avaliadas / total) * 100) : 0;

        progressTextEl.textContent = `${avaliadas} de ${total} (${pct}%)`;
        progressFillEl.style.width = `${pct}%`;
    }

    // 5. Historico de audicoes e reavaliacoes
    const listensLabelEl = document.getElementById("detail-listens-count-label");
    const listensChipsEl = document.getElementById("detail-listens-chips");
    if (listensChipsEl) {
        listensChipsEl.innerHTML = "";
        const historico = getHistorico();
        const reviewsDoMesmo = getReviewsDoMesmoAlbum(historico, estado.album, estado.artista, estado.spotifyId || estado.id);
        const totalAudicoes = Math.max(1, reviewsDoMesmo.length);
        const indexAtual = reviewsDoMesmo.findIndex(r => r.id === estado.id);
        const numeroAudicao = indexAtual !== -1 ? indexAtual + 1 : totalAudicoes;

        if (listensLabelEl) {
            listensLabelEl.textContent = `audição (${numeroAudicao} de ${totalAudicoes}):`;
        }

        reviewsDoMesmo.forEach((r, idx) => {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = `listen-chip${r.id === estado.id ? " active" : ""}`;
            
            const numLabel = `${idx + 1}ª`;
            const dataLabel = formatarDeInputDate(r.listened_at) || r.data || "";
            const notaVal = aEscala(getEffectiveAlbumNota(r), true).toFixed(1);
            const maxScore = getMaxScoreLabel();
            const scoreLabel = r.isDraft ? "rascunho" : `★ ${notaVal}${maxScore}`;

            chip.innerHTML = `
                <span>${numLabel}${r.id === estado.id ? " (atual)" : ""}</span>
                ${dataLabel ? `<span class="chip-date">${dataLabel}</span>` : ""}
                <span class="chip-score">${scoreLabel}</span>
            `;

            chip.onclick = () => {
                if (r.id !== estado.id) {
                    navegarParaReview(r, true);
                }
            };

            listensChipsEl.appendChild(chip);
        });
    }
}

// atualiza os metadados do cabecalho do album (ano, faixas e duracao)
function atualizarAlbumMetaInfo() {
    const metaInfo = document.getElementById("album-meta-info");
    if (!metaInfo) return;

    const totalTracks = estado.tracks ? estado.tracks.length : 0;
    const totalDurationMs = calcularDuracaoTotal(estado.tracks);
    if (totalTracks > 0 || estado.ano) {
        const parts = [];
        if (estado.ano) {
            parts.push(estado.ano);
        }
        if (totalTracks > 0) {
            parts.push(`${totalTracks} ${totalTracks === 1 ? 'música' : 'músicas'}`);
        }
        const formattedDuration = formatarTempoTotal(totalDurationMs);
        if (formattedDuration) {
            parts.push(formattedDuration);
        }
        metaInfo.textContent = parts.join(" • ");
        metaInfo.style.display = "block";
    } else {
        metaInfo.style.display = "none";
    }
}

// busca ano de lancamento do album se estiver ausente no historico legado
async function buscarAnoAlbumSeNecessario() {
    if (!estado || !estado.album || estado.ano) return;
    const albumUrl = estado.link || (estado.id ? `https://open.spotify.com/album/${estado.id}` : null);
    if (!albumUrl) return;

    try {
        const res = await fetch(`/api/album?url=${encodeURIComponent(albumUrl)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.release_date) {
            const releaseYear = data.release_date.split("-")[0];
            if (releaseYear) {
                estado.ano = releaseYear;
                let historico = getHistorico();
                const idx = historico.findIndex((r) => r.id === estado.id || (r.album === estado.album && r.artista === estado.artista));
                if (idx !== -1) {
                    historico[idx].ano = releaseYear;
                    salvarHistorico(historico);
                }
                atualizarAlbumMetaInfo();
            }
        }
    } catch (e) {
        // Silencioso se offline ou falha na API
    }
}

let measureCanvas = null;
function getTitleTextWidth(text, fontSize) {
    if (!measureCanvas) {
        measureCanvas = document.createElement("canvas");
    }
    const ctx = measureCanvas.getContext("2d");
    ctx.font = `800 ${fontSize}px 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif`;
    return ctx.measureText(text).width;
}

let lastObservedTitleWidth = 0;
// ajusta o tamanho da fonte do titulo do album para caber sem quebrar linha
function ajustarTamanhoTituloAlbum(forcar = false) {
    const tituloEl = document.getElementById("titulo");
    if (!tituloEl || !estado.album) return;

    const parent = tituloEl.parentElement;
    if (!parent) return;

    const availableWidth = parent.clientWidth;
    if (availableWidth <= 0) return;

    if (!forcar && Math.abs(availableWidth - lastObservedTitleWidth) < 2) {
        return;
    }
    lastObservedTitleWidth = availableWidth;

    const isMobile = window.innerWidth <= 650;
    // Tamanho base MUITO grande: 86px (~5.4rem) no desktop e 46px no mobile
    const maxFontSize = isMobile ? 46 : 86;
    const minFontSize = isMobile ? 18 : 22;

    const naturalWidth = getTitleTextWidth(estado.album, maxFontSize);

    if (naturalWidth > availableWidth) {
        const ratio = (availableWidth - 8) / naturalWidth;
        const targetSize = Math.max(minFontSize, Math.floor(maxFontSize * ratio));
        tituloEl.style.fontSize = `${targetSize}px`;
    } else {
        tituloEl.style.fontSize = `${maxFontSize}px`;
    }
}

let tituloResizeObserver = null;
function iniciarObservadorTitulo() {
    const titleGroup = document.querySelector(".album-title-group");
    if (titleGroup && window.ResizeObserver && !tituloResizeObserver) {
        tituloResizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const width = entry.contentRect.width;
                if (width > 0 && Math.abs(width - lastObservedTitleWidth) >= 4) {
                    ajustarTamanhoTituloAlbum();
                }
            }
        });
        tituloResizeObserver.observe(titleGroup);
    }
}

// desenha a tela do editor
function render() {
    const header = document.getElementById("header");
    const tracksDiv = document.getElementById("tracks");
    const actionsDiv = document.getElementById("album-actions");
    const placeholder = document.getElementById("placeholder");
    const notesContainer = document.getElementById("notes-container");
    const asideRight = document.getElementById("review-aside-right");

    const layout = document.querySelector(".editor-layout");
    if (layout) {
        if (estado.album) {
            layout.classList.remove("has-placeholder");
        } else {
            layout.classList.add("has-placeholder");
        }
    }

    if (estado.album) {
        header.style.display = "flex";
        tracksDiv.style.display = "block";
        if (notesContainer) notesContainer.style.display = "flex";
        if (actionsDiv) actionsDiv.style.display = "flex";
        if (asideRight) asideRight.style.display = "flex";
        placeholder.style.display = "none";
    } else {
        header.style.display = "none";
        tracksDiv.style.display = "none";
        if (notesContainer) notesContainer.style.display = "none";
        if (actionsDiv) actionsDiv.style.display = "none";
        if (asideRight) asideRight.style.display = "none";
        placeholder.style.display = "block";
    }

    const reviewNotes = document.getElementById("review-notes");
    if (reviewNotes) {
        reviewNotes.value = estado.anotacoes || "";
        reviewNotes.oninput = (e) => {
            estado.anotacoes = e.target.value;
            autoSaveDraft();
        };
    }

    document.getElementById("titulo").textContent = estado.album;
    document.getElementById("artista").textContent = estado.artista;

    atualizarAlbumMetaInfo();
    lastObservedTitleWidth = 0;
    ajustarTamanhoTituloAlbum(true);

    if (!estado.data) {
        estado.data = getDataHoje();
    }

    const capa = document.getElementById("capa");
    capa.src = estado.capa || "";
    capa.style.cursor = "pointer";
    capa.onclick = () => { if (estado.link) window.open(estado.link, "_blank"); };

    atualizarFundo(estado.capa);

    const maxScoreLabel = getMaxScoreLabel();
    const autoCalc = isAlbumAutoCalc(estado);

    const albumStarsEl = document.getElementById("album-stars");
    if (albumStarsEl) {
        if (autoCalc) {
            albumStarsEl.classList.add("stars-calculated");
        } else {
            albumStarsEl.classList.remove("stars-calculated");
        }
    }

    criarEstrelas(
        albumStarsEl,
        aEscala(getEffectiveAlbumNota(estado), true),
        (val) => {
            if (autoCalc) {
                // Ao clicar nas estrelas do album enquanto a media simples esta ativa,
                // alterna automaticamente o album para o modo de nota manual com a nota escolhida!
                estado.calcMode = "manual";
                estado.albumNota = deEscala(val);
                render();
                return;
            }
            estado.albumNota = deEscala(val);
            render();
        },
        true,
    );

    const scoreVal = document.getElementById("album-score-value");
    if (scoreVal) {
        const notaExibida = aEscala(getEffectiveAlbumNota(estado));
        scoreVal.innerHTML = `<span class="current-score">${notaExibida}</span><span class="max-score">${maxScoreLabel}</span>`;
    }

    tracksDiv.innerHTML = "<h3>tracklist</h3>";
    estado.tracks.forEach((track, i) => {
        const div = document.createElement("div");
        div.className = "track" + (isFirstLoad ? " animate" : "");
        if (isFirstLoad) {
            div.style.animationDelay = `${i * 0.03}s`;
        }

        const nome = document.createElement("div");
        nome.className = "track-name-container";
        nome.innerHTML = `<span class="track-index">${i + 1}.</span><span class="track-title">${track.nome}</span>`;

        const right = document.createElement("div");
        right.className = "right";

        const estrelas = document.createElement("div");
        estrelas.className = "estrelas";
        const notaExibida = aEscala(track.nota, false);
        criarEstrelas(estrelas, notaExibida, (val) => {
            if (notaExibida === val) {
                const scale = getRatingScale();
                const minVal = scale === "5" ? 0 : 1;
                track.nota = deEscala(minVal);
            } else {
                track.nota = deEscala(val);
            }
            if (isAlbumAutoCalc(estado)) {
                recalcularNotaAlbum();
            }
            render();
        });

        const crown = document.createElement("button");
        crown.className = `crown-btn ${track.fav ? "active" : ""}`;
        crown.setAttribute("title", track.fav ? "Faixa favorita" : "Marcar como favorita");
        crown.innerHTML = `
            <svg class="crown-icon" width="16" height="16"><use href="icons/sprite.svg#icon-crown"></use></svg>
        `;
        crown.onpointerdown = (e) => e.stopPropagation();
        crown.onpointerup = (e) => e.stopPropagation();
        crown.ontouchstart = (e) => e.stopPropagation();
        crown.ontouchend = (e) => e.stopPropagation();
        crown.onclick = (e) => {
            e.stopPropagation();
            if (track.fav) track.fav = false;
            else {
                estado.tracks.forEach((t) => (t.fav = false));
                track.fav = true;
            }
            render();
        };

        if (track.duration_ms) {
            const durationSpan = document.createElement("span");
            durationSpan.className = "track-duration";
            durationSpan.textContent = formatarTempo(track.duration_ms);
            right.appendChild(durationSpan);
        }

        estrelas.appendChild(crown);
        right.append(estrelas);
        div.append(nome, right);
        tracksDiv.appendChild(div);
    });

    isFirstLoad = false;
    autoSaveDraft();
    carregarHistorico();
    atualizarPainelLateralReview();
    recalcularDimensoesEditorSidebar();
}

// salvar reviews e historico

// pega historico do localstorage
function getHistorico() {
    return JSON.parse(localStorage.getItem("reviews")) || [];
}

// salva historico no localstorage
function salvarHistorico(historico) {
    localStorage.setItem("reviews", JSON.stringify(historico));
    const rascunhosCount = historico.filter(r => r.isDraft).length;
    atualizarNotificacaoApp(rascunhosCount);
    window.loopdCloud?.scheduleSync();
}

// converte data para comparar
function getSortableDate(dateStr) {
    if (!dateStr) return 0;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return 0;
    const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
    return parseInt(`${y}${parts[1]}${parts[0]}`, 10);
}

// salva review definitiva
function salvarReview() {
    if (!estado.id) return alert("nenhum album para salvar!!!");

    if (!estado.createdAt) estado.createdAt = Date.now();
    estado.isDraft = false;

    let historico = getHistorico();
    const index = historico.findIndex((r) => r.id === estado.id || (!r.id && r.album === estado.album && r.artista === estado.artista));

    if (index !== -1) {
        historico[index] = { ...estado };
    } else {
        const newDateVal = getSortableDate(estado.data);
        let insertIndex = historico.findIndex(r => getSortableDate(r.data) < newDateVal);

        if (insertIndex === -1) {
            historico.push({ ...estado });
        } else {
            historico.splice(insertIndex, 0, { ...estado });
        }
    }

    salvarHistorico(historico);
    carregarHistorico();
    atualizarPainelLateralReview();

    const btn = document.getElementById("btn-salvar");
    if (btn) {
        const textoOriginal = "salvar review";
        btn.textContent = "salvo!!!";
        setTimeout(() => {
            btn.textContent = textoOriginal;
        }, 2000);
    }
}

// tooltip do historico
function posicionarHistoryTooltip(targetEl, album, artista, isDraft, data) {
    let tooltip = document.getElementById("history-tooltip");
    if (!tooltip) {
        tooltip = document.createElement("div");
        tooltip.id = "history-tooltip";
        tooltip.className = "history-tooltip";
        tooltip.innerHTML = `
            <div class="history-tooltip-title" id="history-tooltip-title"></div>
            <div class="history-tooltip-artist" id="history-tooltip-artist"></div>
            <div class="history-tooltip-badge" id="history-tooltip-badge" style="display: none;"></div>
        `;
        document.body.appendChild(tooltip);
    }

    const titleEl = document.getElementById("history-tooltip-title");
    const artistEl = document.getElementById("history-tooltip-artist");
    const badgeEl = document.getElementById("history-tooltip-badge");

    if (titleEl) titleEl.textContent = album || "sem título";
    if (artistEl) artistEl.textContent = artista || "artista desconhecido";
    if (badgeEl) {
        if (isDraft) {
            badgeEl.textContent = "rascunho";
            badgeEl.style.display = "block";
        } else if (data) {
            badgeEl.textContent = data;
            badgeEl.style.display = "block";
        } else {
            badgeEl.style.display = "none";
        }
    }

    tooltip.classList.add("visible");

    const rect = targetEl.getBoundingClientRect();
    const tooltipWidth = tooltip.offsetWidth || 180;
    const tooltipHeight = tooltip.offsetHeight || 50;

    // Posiciona sempre à direita do álbum, nunca em cima dele
    let left = rect.right + 12;
    let top = rect.top + (rect.height / 2) - (tooltipHeight / 2);

    // Ajusta limites verticais dentro da viewport
    if (top < 10) top = 10;
    if (top + tooltipHeight > window.innerHeight - 10) {
        top = window.innerHeight - tooltipHeight - 10;
    }

    // Ajusta limite horizontal se necessário, mas mantendo sempre à direita da capa
    if (left + tooltipWidth > window.innerWidth - 10) {
        left = Math.max(rect.right + 6, window.innerWidth - tooltipWidth - 10);
    }

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
}

function esconderHistoryTooltip() {
    const tooltip = document.getElementById("history-tooltip");
    if (tooltip) {
        tooltip.classList.remove("visible");
    }
}

// controle de colunas arrastáveis do histórico
const HISTORY_COL_WIDTHS = {
    1: 108,
    2: 190,
    3: 272
};

function getHistoryColumns() {
    const saved = localStorage.getItem("loopd-history-columns");
    const num = parseInt(saved, 10);
    return (num >= 1 && num <= 3) ? num : 1;
}

function setHistoryColumns(cols, salvar = true) {
    const validCols = Math.max(1, Math.min(3, cols));
    const layout = document.querySelector(".editor-layout");
    const badge = document.getElementById("history-resizer-badge");
    const resizer = document.getElementById("history-resizer");

    const widthPx = HISTORY_COL_WIDTHS[validCols];

    if (layout) {
        layout.style.setProperty("--history-cols", validCols);
        layout.style.setProperty("--history-sidebar-width", `${widthPx}px`);
    }

    if (badge) {
        badge.textContent = `${validCols} ${validCols === 1 ? 'coluna' : 'colunas'}`;
    }

    if (resizer) {
        resizer.setAttribute("aria-valuenow", validCols);
    }

    if (salvar) {
        localStorage.setItem("loopd-history-columns", validCols);
    }

    if (typeof ajustarTamanhoTituloAlbum === "function") {
        ajustarTamanhoTituloAlbum(true);
    }
}

function inicializarRedimensionamentoHistorico() {
    const resizer = document.getElementById("history-resizer");
    const wrapper = document.getElementById("editor-sidebar-wrapper");
    const badge = document.getElementById("history-resizer-badge");
    if (!resizer || !wrapper) return;

    let isDragging = false;
    let currentCols = getHistoryColumns();

    // Aplica o valor inicial salvo
    setHistoryColumns(currentCols, false);

    resizer.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return; // apenas botão esquerdo
        if (window.innerWidth <= 980) return; // desativa em tablet/mobile

        isDragging = true;
        currentCols = getHistoryColumns();

        resizer.setPointerCapture(e.pointerId);
        resizer.classList.add("is-dragging");
        document.body.classList.add("resizing-sidebar");

        if (badge) {
            badge.textContent = `${currentCols} ${currentCols === 1 ? 'coluna' : 'colunas'}`;
        }
    });

    resizer.addEventListener("pointermove", (e) => {
        if (!isDragging) return;

        const wrapperRect = wrapper.getBoundingClientRect();
        // Distância do lado esquerdo da barra até o cursor
        const currentWidth = e.clientX - wrapperRect.left;

        // Limiares de encaixe:
        // O tamanho só muda quando outro álbum completo encaixar ao lado!
        // 1 col = 108px, 2 cols = 190px, 3 cols = 272px
        let targetCols = currentCols;

        if (currentCols === 1) {
            if (currentWidth >= 186) {
                targetCols = 2;
            }
        } else if (currentCols === 2) {
            if (currentWidth < 165) {
                targetCols = 1;
            } else if (currentWidth >= 268) {
                targetCols = 3;
            }
        } else if (currentCols === 3) {
            if (currentWidth < 245) {
                targetCols = 2;
            }
        }

        if (targetCols !== currentCols) {
            currentCols = targetCols;
            setHistoryColumns(currentCols, true);
        }
    });

    const stopDragging = (e) => {
        if (!isDragging) return;
        isDragging = false;
        try {
            resizer.releasePointerCapture(e.pointerId);
        } catch (_) {}
        resizer.classList.remove("is-dragging");
        document.body.classList.remove("resizing-sidebar");
        setHistoryColumns(currentCols, true);
    };

    resizer.addEventListener("pointerup", stopDragging);
    resizer.addEventListener("pointercancel", stopDragging);

    // Bônus: clique rápido para alternar (1 -> 2 -> 3 -> 1)
    let clickStartX = 0;
    resizer.addEventListener("mousedown", (e) => { clickStartX = e.clientX; });
    resizer.addEventListener("click", (e) => {
        if (Math.abs(e.clientX - clickStartX) < 4) {
            const nextCols = (getHistoryColumns() % 3) + 1;
            setHistoryColumns(nextCols, true);
        }
    });
}

// variaveis cacheadas para atualizacao instantanea sem layout thrashing
function recalcularDimensoesEditorSidebar() {
    const sidebar = document.getElementById("editor-sidebar");
    const aside = document.getElementById("review-aside-right");
    if (sidebar && (sidebar.style.height || sidebar.style.maxHeight)) {
        sidebar.style.height = "";
        sidebar.style.maxHeight = "";
    }
    if (aside && (aside.style.height || aside.style.maxHeight)) {
        aside.style.height = "";
        aside.style.maxHeight = "";
    }
}

function atualizarAlturaEditorSidebar() {
    recalcularDimensoesEditorSidebar();
}

// desenha historico lateral
function carregarHistorico() {
    const container = document.getElementById("historico");
    if (!container) return;
    container.innerHTML = "";

    // adiciona listener para esconder tooltip ao rolar historico
    const sidebar = document.getElementById("editor-sidebar");
    if (sidebar && !sidebar._hasScrollListener) {
        sidebar.addEventListener("scroll", esconderHistoryTooltip, { passive: true });
        sidebar._hasScrollListener = true;
    }
    if (!container._hasScrollListener) {
        container.addEventListener("scroll", esconderHistoryTooltip, { passive: true });
        container._hasScrollListener = true;
    }

    const historico = getHistorico();

    if (historico.length === 0) {
        container.innerHTML = `<p class="empty-list-msg" style="grid-column: 1 / -1; font-size: 0.8rem; padding: 24px 8px;">nenhuma review ainda</p>`;
        return;
    }

    historico.sort((a, b) => {
        const diff = getSortableDate(b.data) - getSortableDate(a.data);
        return diff !== 0 ? diff : ((b.createdAt || 0) - (a.createdAt || 0));
    });

    historico.forEach((rev) => {
        const item = document.createElement("div");
        item.className = `history-item ${estado.id === rev.id ? "active-review" : ""} ${rev.isDraft ? "draft-review" : ""}`;
        item.setAttribute("aria-label", `${rev.album} — ${rev.artista}`);

        const img = document.createElement("img");
        img.className = "history-cover";
        img.src = rev.capa || "icons/logo.svg";
        img.alt = rev.album || "capa";
        img.loading = "lazy";
        img.onerror = () => {
            img.src = "icons/logo.svg";
        };

        item.onclick = () => {
            esconderHistoryTooltip();
            if (estado.id === rev.id) {
                navegarParaReview(getEmptyState());
            } else {
                navegarParaReview(rev, true);
            }
        };

        item.onmouseenter = () => {
            const dataReview = formatarDeInputDate(rev.listened_at) || rev.data || (rev.createdAt ? new Date(rev.createdAt).toLocaleDateString("pt-BR") : "");
            const reviewsDoMesmo = getReviewsDoMesmoAlbum(historico, rev.album, rev.artista, rev.spotifyId || rev.id);
            let extraLabel = "";
            if (reviewsDoMesmo.length > 1) {
                const idx = reviewsDoMesmo.findIndex(r => r.id === rev.id);
                if (idx !== -1) extraLabel = ` • ${idx + 1}ª audição`;
            }
            posicionarHistoryTooltip(item, rev.album, (rev.artista || "") + extraLabel, rev.isDraft, dataReview);
        };

        item.onmouseleave = () => {
            esconderHistoryTooltip();
        };

        item.appendChild(img);
        container.appendChild(item);
    });
}

// exportar e importar

// gera texto da review
function gerarTextoReview() {
    if (!estado.id) return "";

    let dataReview = estado.data;
    if (!dataReview) {
        dataReview = getDataHoje();
    }
    let texto = `-${estado.album}- ${dataReview}\n\n`;

    const ratingScale = getRatingScale();
    const maxLabel = getMaxScoreLabel();

    estado.tracks.forEach((t, i) => {
        texto += `${i + 1}. ${t.nome} - ${aEscala(t.nota)}${maxLabel} ${t.fav ? "👑" : ""}\n`;
    });

    const maxStars = ratingScale === "5" ? 5 : 9;
    const notaEstrelas = aEscala(getEffectiveAlbumNota(estado), true);
    const estrelasStr = "★".repeat(Math.round(notaEstrelas)) + "☆".repeat(maxStars - Math.round(notaEstrelas));
    texto += `\n${estrelasStr}\n`;

    if (estado.anotacoes && estado.anotacoes.trim() !== "") {
        texto += `\n"${estado.anotacoes.trim()}"\n`;
    }

    texto += `\n(${estado.link})\n————————————————————————`;
    return texto;
}

// exporta para txt
function exportarTXT() {
    const texto = gerarTextoReview();
    if (!texto) return alert("nenhum album para exportar!!!");

    const blob = new Blob([texto], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${estado.album}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);

    const btn = document.getElementById("btn-exportar");
    if (btn) {
        const textoOriginal = "exportar review";
        btn.textContent = "exportado!!!";
        setTimeout(() => {
            btn.textContent = textoOriginal;
        }, 2000);
    }
}

// processa texto importado
async function processarTextoReviewImportado(text) {
    if (!text || text.trim() === "") {
        throw new Error("o texto da review está vazio!!!");
    }
    const lines = text.split('\n');
    let urlLine = "";

    let urlIndex = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].includes("spotify.com")) {
            urlLine = lines[i].trim().replace(/[()]/g, '');
            urlIndex = i;
            break;
        }
    }

    if (!urlLine) {
        throw new Error("não encontrei o link do spotify no texto!!!");
    }

    const res = await fetch(`/api/album?url=${encodeURIComponent(urlLine)}`);
    const data = await res.json();

    if (!res.ok || data.error) throw new Error(data.error?.message || "Erro ao buscar dados do Spotify");

    let dataImportada = "";
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
        const dataMatch = lines[i].match(/(\d{2}\/\d{2}\/\d{2,4})/);
        if (dataMatch) {
            dataImportada = dataMatch[1];
            break;
        }
    }

    let anotacoesImportadas = "";
    const estrelasIndex = lines.findIndex(l => l.includes("★") || l.includes("☆"));
    if (estrelasIndex !== -1 && urlIndex !== -1 && urlIndex > estrelasIndex + 1) {
        let notesText = lines.slice(estrelasIndex + 1, urlIndex).join("\n").trim();
        if (notesText.startsWith('"') && notesText.endsWith('"')) {
            notesText = notesText.substring(1, notesText.length - 1).trim();
        }
        anotacoesImportadas = notesText;
    }

    const artistNames = data.artists.map((a) => a.name).join(", ");
    const releaseYear = data.release_date ? data.release_date.split("-")[0] : "";
    let historico = getHistorico();
    const index = historico.findIndex((r) => r.id === data.id || (r.album === data.name && r.artista === artistNames));

    estado = {
        id: data.id,
        album: data.name,
        artista: artistNames,
        ano: releaseYear,
        capa: data.images[0].url,
        link: data.external_urls.spotify,
        albumNota: getDefaultNota(),
        albumNotaCalculada: 0,
        tracks: data.tracks.items.map((t) => ({
            nome: t.name,
            nota: getDefaultNota(),
            fav: false,
            duration_ms: t.duration_ms || 0,
        })),
        data: dataImportada,
        anotacoes: anotacoesImportadas,
        isDraft: index !== -1 ? (historico[index].isDraft !== undefined ? historico[index].isDraft : true) : true,
        createdAt: index !== -1 ? (historico[index].createdAt || Date.now()) : Date.now()
    };

    const normalize = (str) => {
        return str
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, "");
    };

    const processarFaixaImportada = (trackName, nota, max, fav) => {
        if (max === 5) {
            if (nota === 0) {
                nota = 0;
            } else {
                const nota9 = (nota * 9) / 5;
                nota = Math.max(1, Math.round(nota9 * 2) / 2);
            }
        } else {
            nota = Math.max(1, nota);
        }

        const cleanImported = normalize(trackName);

        let trackIndex = estado.tracks.findIndex(t => t.nome.toLowerCase() === trackName.toLowerCase());
        if (trackIndex === -1) {
            trackIndex = estado.tracks.findIndex(t => normalize(t.nome) === cleanImported);
        }
        if (trackIndex === -1 && cleanImported.length > 2) {
            trackIndex = estado.tracks.findIndex(t => {
                const cleanSpotify = normalize(t.nome);
                return cleanSpotify.includes(cleanImported) || cleanImported.includes(cleanSpotify);
            });
        }

        if (trackIndex !== -1) {
            estado.tracks[trackIndex].nota = nota;
            estado.tracks[trackIndex].fav = fav;
        }
    };

    let lastNonEmptyLine = "";
    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;

        // Formato A: música e nota na mesma linha
        const matchFormatA = trimmed.match(/^(?:\d+[\.\s-]+)?(.*?)\s+[-–—]+\s+([\d.,]+)\/(9|5)\s*(👑)?/);
        if (matchFormatA) {
            const trackName = matchFormatA[1].trim();
            const nota = parseFloat(matchFormatA[2].replace(',', '.'));
            const max = parseInt(matchFormatA[3], 10);
            const fav = !!matchFormatA[4];

            processarFaixaImportada(trackName, nota, max, fav);
            lastNonEmptyLine = "";
            return;
        }

        // Formato B: apenas a nota na linha, música na linha anterior
        const matchFormatB = trimmed.match(/^([\d.,]+)\/(9|5)\s*(👑)?$/);
        if (matchFormatB && lastNonEmptyLine) {
            const trackName = lastNonEmptyLine;
            const nota = parseFloat(matchFormatB[1].replace(',', '.'));
            const max = parseInt(matchFormatB[2], 10);
            const fav = !!matchFormatB[3];

            processarFaixaImportada(trackName, nota, max, fav);
            lastNonEmptyLine = "";
            return;
        }

        lastNonEmptyLine = trimmed;
    });

    const estrelasLine = lines.find(l => l.includes("★") || l.includes("☆"));
    if (estrelasLine) {
        const countFull = (estrelasLine.match(/★/g) || []).length;
        const countEmpty = (estrelasLine.match(/☆/g) || []).length;
        const total = countFull + countEmpty;
        if (total === 5) {
            estado.albumNota = deEscala(countFull);
        } else {
            estado.albumNota = countFull;
        }
    }

    if (isAlbumAutoCalc(estado)) {
        recalcularNotaAlbum();
    } else {
        estado.albumNotaCalculada = 0;
    }

    if (index !== -1) {
        historico[index] = { ...estado };
    } else {
        historico.push({ ...estado });
    }
    salvarHistorico(historico);

    navegarParaReview(estado);
}

// importa de arquivo txt
async function importarTXT(event) {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);

    try {
        const text = await file.text();
        event.target.value = "";
        await processarTextoReviewImportado(text);
        setLoading(false);
    } catch (err) {
        setLoading(false);
        render();
        alert(`erro ao importar review: ${err.message}. verifique se o link ainda é valido ou as credenciais da API do Spotify em .env.local.`);
        console.error(err);
    }
}

// exporta backup completo
function exportarHistoricoCompleto() {
    const historico = getHistorico();
    if (historico.length === 0) return alert("historico vazio!!!");

    const data = JSON.stringify(historico, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const hoje = new Date();
    const dataStr = `${hoje.getFullYear()}${String(hoje.getMonth() + 1).padStart(2, '0')}${String(hoje.getDate()).padStart(2, '0')}`;

    const a = document.createElement("a");
    a.href = url;
    a.download = `reviews_backup_${dataStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// importa backup completo
async function importarHistoricoCompleto(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const json = JSON.parse(text);

        if (!Array.isArray(json)) throw new Error("formato invalido");

        salvarHistorico(json);
        carregarHistorico();

        if (json.length > 0) {
            estado = { ...json[0] };
            switchView('dashboard');
            isFirstLoad = true;
            render();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        alert("backup importado com sucesso!!!");
    } catch (err) {
        alert("erro ao importar o backup. verifique se o arquivo esta correto!!!");
        console.error(err);
    }

    event.target.value = "";
}


// configuracao de escalas de notas

// pega escala de nota ativa
function getRatingScale() {
    const saved = localStorage.getItem("rating-scale");
    if (saved) return saved;

    // Se o usuário já possui reviews salvas mas não tinha a preferência explícita,
    // mantém a escala pré-existente (1 a 9 estrelas) para não alterar dados de usuários antigos.
    try {
        const historico = JSON.parse(localStorage.getItem("reviews")) || [];
        if (Array.isArray(historico) && historico.length > 0) {
            localStorage.setItem("rating-scale", "9");
            return "9";
        }
    } catch (_) {}

    // Para novos usuários, o padrão a partir de agora é de 0 a 5 estrelas ("5").
    localStorage.setItem("rating-scale", "5");
    return "5";
}
window.getRatingScale = getRatingScale;

// salva preferenca de escala
function setRatingScale(scale) {
    localStorage.setItem("rating-scale", scale);
    window.loopdCloud?.scheduleSync();
}

// pega modo de calculo da media
function getAutoCalculateMode() {
    return localStorage.getItem("auto-calculate-rating") || "desativado";
}

// salva modo de calculo da media
function setAutoCalculateMode(mode) {
    localStorage.setItem("auto-calculate-rating", mode);
    window.loopdCloud?.scheduleSync();
}

// converte nota para a escala visual
function aEscala(nota, isAlbum = false) {
    if (nota === undefined || nota === null) return getRatingScale() === "5" ? 0 : 1;
    const scale = getRatingScale();
    if (scale === "5") {
        const nota5 = (nota * 5) / 9;
        return Math.max(0, Math.round(nota5 * 2) / 2);
    }
    if (isAlbum) {
        return Math.max(1, Math.round(nota));
    }
    return Math.max(1, Math.round(nota * 2) / 2);
}

// converte nota para a base interna
function deEscala(notaVal) {
    if (notaVal === undefined || notaVal === null) return getRatingScale() === "5" ? 0 : 1;
    const scale = getRatingScale();
    if (scale === "5") {
        if (notaVal === 0) return 0;
        const nota9 = (notaVal * 9) / 5;
        return Math.max(1, Math.round(nota9 * 2) / 2);
    }
    return Math.max(1, notaVal);
}

// verifica se um album esta configurado para usar a media simples das faixas
function isAlbumAutoCalc(rev) {
    if (!rev) return getAutoCalculateMode() === "simples";
    const mode = rev.calcMode || getAutoCalculateMode();
    return mode === "simples";
}
window.isAlbumAutoCalc = isAlbumAutoCalc;

// alterna o modo da nota do album entre media simples e nota personalizada/manual
function alternarModoNotaAlbum(novoModo) {
    if (!estado.album) return;

    const modoAtual = isAlbumAutoCalc(estado) ? "simples" : "manual";
    const targetModo = novoModo || (modoAtual === "simples" ? "manual" : "simples");

    estado.calcMode = targetModo;

    if (targetModo === "simples") {
        recalcularNotaAlbum();
    } else {
        // Se a nota do album ainda estava no valor inicial/padrao mas temos faixas pontuadas com media,
        // preenche albumNota com a media calculada para facilitar o ajuste fino manual
        if (!isTrackAvaliada({ nota: estado.albumNota }) && estado.albumNotaCalculada > 0) {
            estado.albumNota = estado.albumNotaCalculada;
        }
    }

    autoSaveDraft();
    render();
}
window.alternarModoNotaAlbum = alternarModoNotaAlbum;

// pega nota efetiva do album (respeita se o album esta em modo media simples ou nota manual)
function getEffectiveAlbumNota(rev) {
    if (!rev) return 0;
    if (isAlbumAutoCalc(rev)) {
        if (rev.albumNotaCalculada !== undefined && rev.albumNotaCalculada > 0) {
            return rev.albumNotaCalculada;
        }
        if (rev.tracks && rev.tracks.length > 0) {
            const ratedTracks = rev.tracks.filter(isTrackAvaliada);
            if (ratedTracks.length > 0) {
                const sum = ratedTracks.reduce((sum, t) => sum + (t.nota || 0), 0);
                const media = sum / ratedTracks.length;
                return Math.round(media * 2) / 2;
            }
        }
        return 0;
    }
    return rev.albumNota || 0;
}

// recalcula nota pela media das faixas
function recalcularNotaAlbum() {
    if (!estado.tracks || estado.tracks.length === 0) return;

    if (!isAlbumAutoCalc(estado)) return;

    const ratedTracks = estado.tracks.filter(isTrackAvaliada);
    if (ratedTracks.length === 0) {
        estado.albumNotaCalculada = 0;
        return;
    }

    const sum = ratedTracks.reduce((sum, t) => sum + (t.nota || 0), 0);
    const media = sum / ratedTracks.length;
    estado.albumNotaCalculada = Math.round(media * 2) / 2;
}

// Executa a troca da escala de notas das reviews e re-renderiza o app
function updateRatingScaleSettings(value) {
    setRatingScale(value);
    render();
    renderLibrary();
    renderDashboard();
}

// Executa a troca do modo de cálculo da nota do álbum e atualiza o estado
function updateAutoCalculateSettings(value) {
    setAutoCalculateMode(value);
    if (estado.id) {
        if (!estado.calcMode && value !== "desativado") {
            recalcularNotaAlbum();
        }
    }
    render();
    renderLibrary();
}

// layout da biblioteca

// pega layout ativo da biblioteca
function getLibraryLayout() {
    return localStorage.getItem("library-layout") || "grid";
}

// salva layout da biblioteca
function setLibraryLayout(layout) {
    localStorage.setItem("library-layout", layout);
    applyLibraryLayout();
    window.loopdCloud?.scheduleSync();
}

// aplica classes de layout
function applyLibraryLayout() {
    const layout = getLibraryLayout();
    const grid = document.getElementById("library-grid");
    const gridBtn = document.getElementById("layout-grid-btn");
    const listBtn = document.getElementById("layout-list-btn");

    if (grid) {
        if (layout === "list") {
            grid.classList.add("list-view");
        } else {
            grid.classList.remove("list-view");
        }
    }

    if (gridBtn && listBtn) {
        if (layout === "list") {
            gridBtn.classList.remove("active");
            listBtn.classList.add("active");
        } else {
            gridBtn.classList.add("active");
            listBtn.classList.remove("active");
        }
    }
}

// navegacao spa

// troca de aba
function switchView(viewName) {
    if (typeof esconderHistoryTooltip === "function") esconderHistoryTooltip();
    
    // Compatibilidade reversa com nomes antigos
    if (viewName === 'dashboard') viewName = 'profile';
    if (viewName === 'account') viewName = 'settings';

    document.querySelectorAll('.app-view').forEach(view => {
        view.style.display = 'none';
    });

    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) {
        targetView.style.display = (viewName === 'profile') ? 'flex' : 'block';
    }

    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.setAttribute('data-active-view', viewName);
    }

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    const navId = (viewName === 'reviews' || viewName === 'library') ? 'nav-library' : `nav-${viewName}`;
    const activeNav = document.getElementById(navId);
    if (activeNav) {
        activeNav.classList.add('active');
    }

    if (viewName === 'profile') {
        renderProfile();
    } else if (viewName === 'library') {
        renderLibrary();
    } else if (viewName === 'reviews') {
        render();
        atualizarAlturaEditorSidebar();
    } else if (viewName === 'settings') {
        if (window.loopdCloud?.refreshUi) {
            window.loopdCloud.refreshUi();
        }
    }
}

// renderiza tela de perfil (dados do usuario + estatisticas completas)
function renderProfile() {
    renderDashboard();
    atualizarHeaderPerfil();
}

// atualiza header do perfil (avatar, status de login, email/nome)
function atualizarHeaderPerfil() {
    const user = window.loopdCloud?.getUser ? window.loopdCloud.getUser() : null;
    const nameEl = document.getElementById('profile-user-name');
    const badgeEl = document.getElementById('profile-badge-status');
    const badgeTextEl = document.getElementById('profile-badge-text');
    const subEl = document.getElementById('profile-user-sub');
    const avatarEl = document.getElementById('profile-user-avatar');
    const iconEl = document.getElementById('profile-user-icon');

    if (!nameEl) return;

    if (user) {
        const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'usuário';
        const email = user.email || '';
        const avatarUrl = user.user_metadata?.avatar_url;

        nameEl.textContent = name.toLowerCase();
        if (badgeEl) {
            badgeEl.className = 'profile-badge-status online';
        }
        if (badgeTextEl) badgeTextEl.textContent = 'sincronizado';
        if (subEl) subEl.textContent = email;

        if (avatarUrl && avatarEl) {
            avatarEl.src = avatarUrl;
            avatarEl.style.display = 'block';
            if (iconEl) iconEl.style.display = 'none';
        } else {
            if (avatarEl) avatarEl.style.display = 'none';
            if (iconEl) iconEl.style.display = 'block';
        }
    } else {
        nameEl.textContent = 'perfil local';
        if (badgeEl) {
            badgeEl.className = 'profile-badge-status offline';
        }
        if (badgeTextEl) badgeTextEl.textContent = 'offline (local)';
        if (subEl) subEl.textContent = 'conecte sua conta Google nas opções para sincronizar na nuvem';

        if (avatarEl) avatarEl.style.display = 'none';
        if (iconEl) iconEl.style.display = 'block';
    }
}
window.atualizarHeaderPerfil = atualizarHeaderPerfil;

// dashboard

// calcula metricas e desenha dashboard
function renderDashboard() {
    const historico = getHistorico().filter(r => !r.isDraft);

    // media das faixas para desempate
    const getMediaTracks = (r) => {
        if (!r.tracks || r.tracks.length === 0) return 0;
        const rated = r.tracks.filter(isTrackAvaliada);
        if (rated.length === 0) return 0;
        return rated.reduce((sum, t) => sum + (t.nota || 0), 0) / rated.length;
    };

    // ordena albuns por nota e desempata
    const sortedAlbums = [...historico].sort((a, b) => {
        const notaA = getEffectiveAlbumNota(a) || 0;
        const notaB = getEffectiveAlbumNota(b) || 0;
        if (notaA !== notaB) {
            return notaB - notaA;
        }
        return getMediaTracks(b) - getMediaTracks(a);
    });

    const totalAlbums = historico.length;
    document.getElementById("dash-total-reviews").textContent = totalAlbums;

    let sumNotas = 0;
    historico.forEach(r => {
        sumNotas += (getEffectiveAlbumNota(r) || 0);
    });
    const mediaGeral = totalAlbums > 0 ? aEscala(sumNotas / totalAlbums).toFixed(1) : "0.0";
    document.getElementById("dash-average-score").textContent = mediaGeral;

    const artistCounts = {};
    historico.forEach(r => {
        if (r.artista) {
            const artistas = r.artista.split(',').map(a => a.trim());
            artistas.forEach(a => {
                if (a) artistCounts[a] = (artistCounts[a] || 0) + 1;
            });
        }
    });

    let maxCount = 0;
    let topArtist = "-";
    for (const [artist, count] of Object.entries(artistCounts)) {
        if (count > maxCount) {
            maxCount = count;
            topArtist = artist;
        }
    }
    document.getElementById("dash-top-artist").textContent = topArtist !== "-" ? `${topArtist} (${maxCount}x)` : "-";

    let totalTracks = 0;
    let totalFavTracks = 0;
    let totalDurationMs = 0;
    let bestAlbum = sortedAlbums[0] || null;
    const favorites = [];

    historico.forEach(r => {
        if (r.tracks && Array.isArray(r.tracks)) {
            totalTracks += r.tracks.length;
            r.tracks.forEach(t => {
                totalDurationMs += (t.duration_ms || 0);
                if (t.fav) {
                    totalFavTracks++;
                    favorites.push({
                        trackName: t.nome,
                        artista: r.artista,
                        album: r.album,
                        capa: r.capa,
                        nota: t.nota,
                        review: r
                    });
                }
            });
        }
    });

    document.getElementById("dash-total-tracks").textContent = totalTracks;

    const durationEl = document.getElementById("dash-total-duration");
    if (durationEl) {
        durationEl.textContent = formatarTempoTotalDashboard(totalDurationMs);
        const totalSegundos = Math.floor(totalDurationMs / 1000);
        const minutos = Math.floor(totalSegundos / 60);
        const horas = Math.floor(minutos / 60);
        durationEl.title = `Total exato: ${horas}h ${minutos % 60}m`;
    }

    const bestAlbumEl = document.getElementById("dash-best-album");
    if (bestAlbumEl) {
        if (bestAlbum) {
            const maxScore = getMaxScoreLabel();
            const displayStr = `${bestAlbum.album} (${aEscala(getEffectiveAlbumNota(bestAlbum))}${maxScore})`;
            bestAlbumEl.textContent = displayStr;
            bestAlbumEl.title = displayStr;
        } else {
            bestAlbumEl.textContent = "-";
            bestAlbumEl.title = "";
        }
    }

    const scale = getRatingScale();
    const maxStars = scale === "5" ? 5 : 9;
    const isBase5 = (scale === "5");

    const ratingValues = [];
    const stepVal = isBase5 ? 0.5 : 1;
    for (let val = stepVal; val <= maxStars; val += stepVal) {
        ratingValues.push(val);
    }

    const counts = {};
    ratingValues.forEach(val => {
        counts[val] = 0;
    });

    historico.forEach(r => {
        const nota = getEffectiveAlbumNota(r);
        const rawNote = getRatingScale() === "5" ? (nota * 5) / 9 : nota;
        const note = isBase5 ? (Math.round(rawNote * 2) / 2) : Math.round(rawNote);
        if (counts[note] !== undefined) {
            counts[note]++;
        }
    });

    const maxRatingCountRaw = Math.max(...Object.values(counts), 1);
    const steps = [1, 2, 5, 10, 20, 50, 100, 250, 500, 1000];
    let step = 1;
    for (const s of steps) {
        if (Math.ceil(maxRatingCountRaw / s) <= 5) {
            step = s;
            break;
        }
    }

    const chartMaxVal = Math.ceil(maxRatingCountRaw / step) * step;
    const yAxisContainer = document.getElementById("chart-y-axis");
    const gridLinesContainer = document.getElementById("chart-grid-lines");

    if (yAxisContainer && gridLinesContainer) {
        yAxisContainer.innerHTML = "";
        gridLinesContainer.innerHTML = "";

        const ticks = [];
        for (let val = 0; val <= chartMaxVal; val += step) {
            ticks.push(val);
        }

        ticks.forEach(val => {
            const pct = (val / chartMaxVal) * 100;

            const tick = document.createElement("span");
            tick.className = "chart-y-axis-tick";
            tick.style.bottom = `${pct}%`;
            tick.textContent = val;
            yAxisContainer.appendChild(tick);

            const line = document.createElement("div");
            line.className = "grid-line";
            line.style.bottom = `${pct}%`;
            gridLinesContainer.appendChild(line);
        });
    }

    const chartContainer = document.getElementById("rating-distribution-chart");
    chartContainer.innerHTML = "";

    ratingValues.forEach(val => {
        const count = counts[val];
        const pct = (count / chartMaxVal) * 100;

        const col = document.createElement("div");
        col.className = "chart-col";

        const barWrapper = document.createElement("div");
        barWrapper.className = "chart-bar-wrapper";

        const bar = document.createElement("div");
        bar.className = "chart-bar";
        bar.style.height = `0%`;

        const label = document.createElement("span");
        label.className = "chart-label";
        label.textContent = val;

        barWrapper.appendChild(bar);
        col.append(barWrapper, label);
        chartContainer.appendChild(col);

        setTimeout(() => {
            bar.style.height = `${pct}%`;
        }, 50);
    });

    const topAlbums = sortedAlbums.slice(0, 10);
    const topContainer = document.getElementById("dash-top-albums");
    if (topContainer) {
        topContainer.innerHTML = "";
        if (topAlbums.length === 0) {
            topContainer.innerHTML = `<p class="empty-list-msg">nenhum álbum avaliado ainda</p>`;
        } else {
            topAlbums.forEach((rev, index) => {
                const item = document.createElement("div");
                item.className = "dash-top-album-item";

                const rank = document.createElement("span");
                rank.className = `dash-rank-badge ${index < 3 ? 'rank-' + (index + 1) : ''}`;
                rank.textContent = `${index + 1}`;

                const img = document.createElement("img");
                img.src = rev.capa || "";
                img.className = "dash-top-album-cover";
                img.alt = rev.album;

                const info = document.createElement("div");
                info.className = "dash-top-album-info";

                const title = document.createElement("span");
                title.className = "dash-top-album-title";
                title.textContent = rev.album;

                const artist = document.createElement("span");
                artist.className = "dash-top-album-artist";
                artist.textContent = rev.artista;

                info.append(title, artist);

                const score = document.createElement("span");
                score.className = "dash-top-album-score";
                score.textContent = `${aEscala(getEffectiveAlbumNota(rev))}${getMaxScoreLabel()}`;

                item.append(rank, img, info, score);
                item.onclick = () => navegarParaReview(rev);
                topContainer.appendChild(item);
            });
        }
    }

    // 2. Músicas Favoritas
    const favListEl = document.getElementById("dash-favorites-list");
    const favBadgeEl = document.getElementById("dash-fav-badge");
    if (favBadgeEl) {
        favBadgeEl.textContent = favorites.length;
    }
    if (favListEl) {
        favListEl.innerHTML = "";
        favorites.sort((a, b) => {
            const trackNotaA = a.nota || 0;
            const trackNotaB = b.nota || 0;
            if (trackNotaA !== trackNotaB) {
                return trackNotaB - trackNotaA;
            }

            const albumNotaA = getEffectiveAlbumNota(a.review) || 0;
            const albumNotaB = getEffectiveAlbumNota(b.review) || 0;
            if (albumNotaA !== albumNotaB) {
                return albumNotaB - albumNotaA;
            }

            return getMediaTracks(b.review) - getMediaTracks(a.review);
        });

        const displayFavorites = favorites.slice(0, 10);
        if (displayFavorites.length === 0) {
            favListEl.innerHTML = `<p class="empty-list-msg">nenhuma música favorita marcada</p>`;
        } else {
            displayFavorites.forEach(fav => {
                const item = document.createElement("div");
                item.className = "dash-fav-track-item";

                const img = document.createElement("img");
                img.src = fav.capa || "";
                img.className = "dash-fav-track-cover";
                img.alt = fav.album;

                const info = document.createElement("div");
                info.className = "dash-fav-track-info";

                const title = document.createElement("span");
                title.className = "dash-fav-track-title";
                title.textContent = fav.trackName;

                const artist = document.createElement("span");
                artist.className = "dash-fav-track-artist";
                artist.textContent = `${fav.artista} • ${fav.album}`;

                info.append(title, artist);

                const crown = document.createElement("span");
                crown.style.display = "inline-flex";
                crown.style.alignItems = "center";
                crown.innerHTML = `<svg class="dash-fav-crown-svg"><use href="icons/sprite.svg#icon-crown"></use></svg>`;

                item.append(img, info, crown);
                item.onclick = () => navegarParaReview(fav.review);
                favListEl.appendChild(item);
            });
        }
    }

    // 3. Atividade Recente (últimos avaliados)
    const recentListEl = document.getElementById("dash-recent-list");
    if (recentListEl) {
        recentListEl.innerHTML = "";
        const recentReviews = historico.slice(0, 8);
        if (recentReviews.length === 0) {
            recentListEl.innerHTML = `<p class="empty-list-msg">nenhum álbum avaliado ainda</p>`;
        } else {
            recentReviews.forEach(rev => {
                const item = document.createElement("div");
                item.className = "dash-recent-item";

                const img = document.createElement("img");
                img.src = rev.capa || "";
                img.className = "dash-recent-cover";
                img.alt = rev.album;

                const info = document.createElement("div");
                info.className = "dash-recent-info";

                const title = document.createElement("span");
                title.className = "dash-recent-title";
                title.textContent = rev.album;

                const meta = document.createElement("span");
                meta.className = "dash-recent-meta";
                meta.textContent = `${rev.artista} • ${rev.data || ""}`;

                info.append(title, meta);

                const score = document.createElement("span");
                score.className = "dash-recent-score";
                score.textContent = `${aEscala(getEffectiveAlbumNota(rev))}${getMaxScoreLabel()}`;

                item.append(img, info, score);
                item.onclick = () => navegarParaReview(rev);
                recentListEl.appendChild(item);
            });
        }
    }

    // 4. Top Artistas
    const topArtistsEl = document.getElementById("dash-top-artists");
    if (topArtistsEl) {
        topArtistsEl.innerHTML = "";
        const artistStats = {};
        historico.forEach(r => {
            if (r.artista) {
                const artistas = r.artista.split(',').map(a => a.trim());
                artistas.forEach(a => {
                    if (!a) return;
                    if (!artistStats[a]) {
                        artistStats[a] = { count: 0, sumNotas: 0, cover: r.capa };
                    }
                    artistStats[a].count++;
                    artistStats[a].sumNotas += (getEffectiveAlbumNota(r) || 0);
                });
            }
        });

        const sortedArtists = Object.entries(artistStats)
            .map(([name, data]) => ({
                name,
                count: data.count,
                avg: data.sumNotas / data.count,
                cover: data.cover
            }))
            .sort((a, b) => {
                if (b.count !== a.count) return b.count - a.count;
                return b.avg - a.avg;
            })
            .slice(0, 8);

        if (sortedArtists.length === 0) {
            topArtistsEl.innerHTML = `<p class="empty-list-msg">nenhum artista avaliado ainda</p>`;
        } else {
            sortedArtists.forEach((art, index) => {
                const item = document.createElement("div");
                item.className = "dash-top-artist-item";

                const rank = document.createElement("span");
                rank.className = `dash-rank-badge ${index < 3 ? 'rank-' + (index + 1) : ''}`;
                rank.textContent = `${index + 1}`;

                const avatar = document.createElement("div");
                avatar.className = "dash-artist-avatar";
                if (art.cover) {
                    const img = document.createElement("img");
                    img.src = art.cover;
                    img.style.width = "100%";
                    img.style.height = "100%";
                    img.style.borderRadius = "50%";
                    img.style.objectFit = "cover";
                    avatar.appendChild(img);
                } else {
                    avatar.textContent = art.name.charAt(0).toUpperCase();
                }

                const info = document.createElement("div");
                info.className = "dash-top-artist-info";

                const name = document.createElement("span");
                name.className = "dash-top-artist-name";
                name.textContent = art.name;

                const count = document.createElement("span");
                count.className = "dash-top-artist-count";
                count.textContent = `${art.count} ${art.count === 1 ? 'álbum avaliado' : 'álbuns avaliados'}`;

                info.append(name, count);

                const avg = document.createElement("span");
                avg.className = "dash-top-artist-avg";
                avg.textContent = `${aEscala(art.avg).toFixed(1)}${getMaxScoreLabel()}`;

                item.append(rank, avatar, info, avg);
                item.onclick = () => {
                    switchView('library');
                    const searchInput = document.getElementById("library-search");
                    if (searchInput) {
                        searchInput.value = art.name;
                        renderLibrary();
                    }
                };
                topArtistsEl.appendChild(item);
            });
        }
    }

    // 5. Estatísticas & Curiosidades
    const insightsEl = document.getElementById("dash-insights-list");
    if (insightsEl) {
        insightsEl.innerHTML = "";
        const albunsCompletos = historico.filter(r => {
            if (!r.tracks || r.tracks.length === 0) return false;
            return r.tracks.every(isTrackAvaliada);
        }).length;
        const pctCompletos = totalAlbums > 0 ? Math.round((albunsCompletos / totalAlbums) * 100) : 0;
        const avgFavs = totalAlbums > 0 ? (totalFavTracks / totalAlbums).toFixed(1) : "0";
        const ratedTracksCount = historico.reduce((acc, r) => acc + (r.tracks ? r.tracks.filter(isTrackAvaliada).length : 0), 0);
        const pctRatedTracks = totalTracks > 0 ? Math.round((ratedTracksCount / totalTracks) * 100) : 0;

        const insights = [
            {
                label: "álbuns completos",
                value: `${albunsCompletos}/${totalAlbums}`,
                sub: `${pctCompletos}% 100% avaliados`,
                highlight: true
            },
            {
                label: "músicas favoritas",
                value: `${totalFavTracks}`,
                sub: `coroadas na biblioteca`
            },
            {
                label: "taxa de favoritas",
                value: `${avgFavs}`,
                sub: `média por álbum`
            },
            {
                label: "faixas avaliadas",
                value: `${pctRatedTracks}%`,
                sub: `${ratedTracksCount} de ${totalTracks} faixas`
            }
        ];

        insights.forEach(ins => {
            const card = document.createElement("div");
            card.className = "dash-insight-card";
            card.innerHTML = `
                <span class="dash-insight-label">${ins.label}</span>
                <span class="dash-insight-value ${ins.highlight ? 'highlight' : ''}">${ins.value}</span>
                <span class="dash-insight-sub">${ins.sub}</span>
            `;
            insightsEl.appendChild(card);
        });
    }
}

// biblioteca

// inverte direcao de ordenacao
function toggleLibrarySortOrder() {
    librarySortDesc = !librarySortDesc;

    const icon = document.getElementById("sort-order-icon");
    if (icon) {
        const spriteId = librarySortDesc ? "icon-sort-order" : "icon-sort-asc";
        icon.innerHTML = `<use href="icons/sprite.svg#${spriteId}"></use>`;
    }
    renderLibrary();
}

// filtra e desenha biblioteca
function renderLibrary() {
    applyLibraryLayout();
    const libraryGrid = document.getElementById("library-grid");
    if (!libraryGrid) return;
    libraryGrid.innerHTML = "";

    const historico = getHistorico();
    if (historico.length === 0) {
        libraryGrid.innerHTML = `<p class="empty-library-msg">sua biblioteca está vazia. cole o link de um álbum do spotify no cabeçalho para começar a sua avaliação!</p>`;
        return;
    }

    const searchInput = document.getElementById("library-search");
    const busca = searchInput ? searchInput.value.toLowerCase().trim() : "";

    let filteredHistorico = [...historico];
    if (busca) {
        filteredHistorico = filteredHistorico.filter(r =>
            (r.album && r.album.toLowerCase().includes(busca)) ||
            (r.artista && r.artista.toLowerCase().includes(busca))
        );
    }

    if (filteredHistorico.length === 0) {
        libraryGrid.innerHTML = `<p class="empty-library-msg">nenhum álbum encontrado para "${busca}"</p>`;
        return;
    }

    const sortBy = document.getElementById("library-sort-by").value;
    filteredHistorico.sort((a, b) => {
        let valA = 0;
        let valB = 0;
        if (sortBy === 'date') {
            valA = getSortableDate(a.data);
            valB = getSortableDate(b.data);
        } else if (sortBy === 'score') {
            valA = getEffectiveAlbumNota(a) || 0;
            valB = getEffectiveAlbumNota(b) || 0;
        } else if (sortBy === 'tracks_count') {
            valA = a.tracks ? a.tracks.length : 0;
            valB = b.tracks ? b.tracks.length : 0;
        } else if (sortBy === 'duration') {
            valA = calcularDuracaoTotal(a.tracks);
            valB = calcularDuracaoTotal(b.tracks);
        }

        if (librarySortDesc) {
            return valA !== valB ? valB - valA : ((b.createdAt || 0) - (a.createdAt || 0));
        } else {
            return valA !== valB ? valA - valB : ((a.createdAt || 0) - (b.createdAt || 0));
        }
    });

    filteredHistorico.forEach(rev => {
        const card = document.createElement("div");
        card.className = `library-card${rev.isDraft ? " is-draft" : ""}`;

        const coverWrapper = document.createElement("div");
        coverWrapper.className = "library-card-cover-wrapper";

        const img = document.createElement("img");
        img.src = rev.capa || "";
        img.alt = rev.album;
        img.className = "library-card-cover";
        coverWrapper.appendChild(img);

        const info = document.createElement("div");
        info.className = "library-card-info";

        const title = document.createElement("h3");
        title.className = "library-card-title";
        title.textContent = rev.album;

        const artist = document.createElement("p");
        artist.className = "library-card-artist";
        artist.textContent = rev.artista;

        const metaRow = document.createElement("div");
        metaRow.className = "library-card-meta";

        const score = document.createElement("span");
        score.className = "library-card-score";
        const maxScore = getMaxScoreLabel();
        if (rev.isDraft) {
            score.innerHTML = `<span class="draft-badge-label">rascunho</span>`;
        } else {
            score.innerHTML = `<span class="score-star">★</span> ${aEscala(getEffectiveAlbumNota(rev))}${maxScore}`;
        }

        const date = document.createElement("span");
        date.className = "library-card-date";
        date.textContent = rev.isDraft ? "" : (formatarDeInputDate(rev.listened_at) || rev.data || "-");

        metaRow.append(score, date);

        const reviewsDoMesmo = getReviewsDoMesmoAlbum(historico, rev.album, rev.artista, rev.spotifyId || rev.id);
        if (reviewsDoMesmo.length > 1) {
            const idx = reviewsDoMesmo.findIndex(r => r.id === rev.id);
            const numAudicao = idx !== -1 ? idx + 1 : reviewsDoMesmo.length;
            const listensBadge = document.createElement("span");
            listensBadge.className = "library-badge-listens";
            listensBadge.title = `${numAudicao}ª audição registrada deste álbum (total: ${reviewsDoMesmo.length})`;
            listensBadge.innerHTML = `<svg width="10" height="10" style="margin-right:2px;"><use href="icons/sprite.svg#icon-refresh"></use></svg>${numAudicao}ª escuta`;
            metaRow.appendChild(listensBadge);
        }

        const notes = document.createElement("p");
        notes.className = "library-card-notes";
        const annotationText = rev.anotacoes ? (rev.anotacoes.length > 80 ? rev.anotacoes.substring(0, 80) + "..." : rev.anotacoes) : "";
        notes.textContent = annotationText ? `"${annotationText}"` : "sem anotações.";

        const durationText = document.createElement("p");
        durationText.className = "library-card-duration";
        const totalTracks = rev.tracks ? rev.tracks.length : 0;
        const totalDurationMs = calcularDuracaoTotal(rev.tracks);
        if (totalTracks > 0) {
            const formattedDuration = formatarTempoTotal(totalDurationMs);
            const durationPart = formattedDuration ? ` • ${formattedDuration}` : "";
            durationText.textContent = `${totalTracks} ${totalTracks === 1 ? 'música' : 'músicas'}${durationPart}`;
        } else {
            durationText.textContent = "";
        }

        info.append(title, artist, durationText, metaRow, notes);
        card.append(coverWrapper, info);

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "library-card-delete-btn";
        deleteBtn.title = "Excluir review";
        deleteBtn.innerHTML = `<svg class="close-icon" viewBox="0 0 24 24" width="12" height="12"><use href="icons/sprite.svg#icon-close"></use></svg>`;
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            if (confirm(`deseja realmente apagar a review de "${rev.album}"?`)) {
                deletarReviewSemConfirmacao(rev.id, rev.album, rev.artista);
                renderLibrary();
            }
        };
        card.appendChild(deleteBtn);

        card.onclick = () => {
            navegarParaReview(rev);
        };

        libraryGrid.appendChild(card);
    });
}

// apaga historico do localstorage
function limparTudo() {
    if (confirm("ATENÇÃO: isso apagará permanentemente todas as suas reviews salvas! esta ação não pode ser desfeita. deseja continuar?")) {
        localStorage.removeItem("reviews");
        window.loopdCloud?.scheduleSync(0);
        estado = getEmptyState();
        render();
        switchView('dashboard');
        atualizarNotificacaoApp(0);
        alert("todos os dados foram apagados com sucesso!");
    }
}

// fecha busca se clicar fora

document.addEventListener("click", (e) => {
    const searchWrapper = document.getElementById("library-search-wrapper");
    const searchInput = document.getElementById("library-search");
    if (searchWrapper && searchInput && !searchWrapper.contains(e.target)) {
        if (searchWrapper.classList.contains("expanded")) {
            const hadValue = searchInput.value !== "";
            searchInput.value = "";
            searchWrapper.classList.remove("expanded");
            if (hadValue) {
                renderLibrary();
            }
        }
    }
});

// inicia controles segmentados
function inicializarControlesSegmentados() {
    // escala de notas
    const scaleVal = getRatingScale();
    const scaleControl = document.getElementById("segmented-rating-scale");
    if (scaleControl) {
        scaleControl.querySelectorAll(".segmented-btn").forEach(btn => {
            if (btn.getAttribute("data-value") === scaleVal) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
            btn.addEventListener("click", () => {
                const val = btn.getAttribute("data-value");
                updateRatingScaleSettings(val);
                scaleControl.querySelectorAll(".segmented-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
            });
        });
    }

    // calculo da nota
    const autoVal = getAutoCalculateMode();
    const autoControl = document.getElementById("segmented-auto-calculate");
    if (autoControl) {
        autoControl.querySelectorAll(".segmented-btn").forEach(btn => {
            if (btn.getAttribute("data-value") === autoVal) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
            btn.addEventListener("click", () => {
                const val = btn.getAttribute("data-value");
                updateAutoCalculateSettings(val);
                autoControl.querySelectorAll(".segmented-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
            });
        });
    }
}


// abre ou fecha busca
function toggleLibrarySearch(e) {
    if (e) {
        e.stopPropagation();
        e.preventDefault();
    }
    const wrapper = document.getElementById("library-search-wrapper");
    const input = document.getElementById("library-search");
    if (!wrapper || !input) return;

    const isExpanded = wrapper.classList.contains("expanded");
    if (!isExpanded) {
        wrapper.classList.add("expanded");
        setTimeout(() => {
            input.focus();
        }, 50);
    }
}

// clipboard

// controla dropdown


// cola review da area de transferencia
async function colarReviewClipboard() {
    setLoading(true);
    try {
        const text = await navigator.clipboard.readText();
        await processarTextoReviewImportado(text);
        setLoading(false);
    } catch (err) {
        setLoading(false);
        render();
        alert(`erro ao colar review: ${err.message}. verifique se concedeu permissão de clipboard ao site.`);
        console.error(err);
    }
}

// copia review para a area de transferencia
async function copiarReviewClipboard() {
    const texto = gerarTextoReview();
    if (!texto) return alert("nenhum album para copiar!!!");

    try {
        await navigator.clipboard.writeText(texto);

        const btnCopiar = document.getElementById("btn-copiar-item");
        if (btnCopiar) {
            const originalHTML = btnCopiar.innerHTML;
            btnCopiar.innerHTML = `
                <svg viewBox="0 0 24 24" width="14" height="14" style="margin-right: 8px; color: var(--color-primary-light);"><use href="icons/sprite.svg#icon-checkmark"></use></svg>
                copiado!!!
            `;
            setTimeout(() => {
                btnCopiar.innerHTML = originalHTML;
            }, 1500);
        }
    } catch (err) {
        alert("erro ao copiar review para a área de transferência!!!");
        console.error(err);
    }
}

// customizacao do fundo dinamico (blur e brightness)
const DEFAULT_BG_BLUR = 16;
const DEFAULT_BG_BRIGHTNESS = 50;

function getBgBlur() {
    const val = localStorage.getItem("loopd-bg-blur");
    if (val === null || isNaN(Number(val))) return DEFAULT_BG_BLUR;
    return Math.min(64, Math.max(0, Math.round(Number(val))));
}

function getBgBrightness() {
    const val = localStorage.getItem("loopd-bg-brightness");
    if (val === null || isNaN(Number(val))) return DEFAULT_BG_BRIGHTNESS;
    const num = Number(val);
    // Suporte a compatibilidade caso exista valor decimal antigo salvo (ex: 0.6 ou 0.5)
    if (num > 0 && num <= 1) return Math.round(num * 100);
    return Math.min(100, Math.max(0, Math.round(num)));
}

function aplicarEstilosFundo(blurVal, brightnessVal) {
    const blur = blurVal !== undefined ? blurVal : getBgBlur();
    const brightness = brightnessVal !== undefined ? brightnessVal : getBgBrightness();
    document.documentElement.style.setProperty("--bg-blur", `${blur}px`);
    document.documentElement.style.setProperty("--bg-brightness", (brightness / 100).toFixed(2));
}

function atualizarBgBlur(val) {
    let num = Math.min(64, Math.max(0, Math.round(Number(val))));
    num = Math.round(num / 2) * 2;
    localStorage.setItem("loopd-bg-blur", num);
    aplicarEstilosFundo(num, undefined);
    const badge = document.getElementById("slider-blur-val");
    if (badge) badge.textContent = `${num}px`;
    const input = document.getElementById("setting-bg-blur");
    if (input && Number(input.value) !== num) input.value = num;
    window.loopdCloud?.scheduleSync?.(1200);
}

function atualizarBgBrightness(val) {
    let num = Math.min(100, Math.max(0, Math.round(Number(val))));
    num = Math.round(num / 5) * 5;
    localStorage.setItem("loopd-bg-brightness", num);
    aplicarEstilosFundo(undefined, num);
    const badge = document.getElementById("slider-brightness-val");
    if (badge) badge.textContent = `${num}%`;
    const input = document.getElementById("setting-bg-brightness");
    if (input && Number(input.value) !== num) input.value = num;
    window.loopdCloud?.scheduleSync?.(1200);
}

function resetarBgBlur() {
    atualizarBgBlur(DEFAULT_BG_BLUR);
}

function resetarBgBrightness() {
    atualizarBgBrightness(DEFAULT_BG_BRIGHTNESS);
}

function inicializarCustomizacaoVisual() {
    const blur = getBgBlur();
    const brightness = getBgBrightness();
    aplicarEstilosFundo(blur, brightness);

    const blurInput = document.getElementById("setting-bg-blur");
    const blurBadge = document.getElementById("slider-blur-val");
    if (blurInput) blurInput.value = blur;
    if (blurBadge) blurBadge.textContent = `${blur}px`;

    const brightnessInput = document.getElementById("setting-bg-brightness");
    const brightnessBadge = document.getElementById("slider-brightness-val");
    if (brightnessInput) brightnessInput.value = brightness;
    if (brightnessBadge) brightnessBadge.textContent = `${brightness}%`;
}

// aplica estilos logo ao carregar para evitar qualquer flash
aplicarEstilosFundo();

window.getBgBlur = getBgBlur;
window.getBgBrightness = getBgBrightness;
window.aplicarEstilosFundo = aplicarEstilosFundo;
window.atualizarBgBlur = atualizarBgBlur;
window.atualizarBgBrightness = atualizarBgBrightness;
window.resetarBgBlur = resetarBgBlur;
window.resetarBgBrightness = resetarBgBrightness;
window.inicializarCustomizacaoVisual = inicializarCustomizacaoVisual;
window.setHistoryColumns = setHistoryColumns;
window.getHistoryColumns = getHistoryColumns;

// inicializacao

document.addEventListener("DOMContentLoaded", () => {
    applyLibraryLayout();
    inicializarRedimensionamentoHistorico();
    carregarHistorico();
    inicializarControlesSegmentados();
    inicializarCustomizacaoVisual();
    iniciarObservadorTitulo();
    switchView('library');
    atualizarNotificacaoApp(obterContadorRascunhos());

    // Limpa o campo de busca quando clicado se contiver texto/link
    const urlInput = document.getElementById("url");
    if (urlInput) {
        urlInput.addEventListener("click", () => {
            if (urlInput.value.trim() !== "") {
                urlInput.value = "";
            }
        });
    }

    window.addEventListener("resize", () => {
        recalcularDimensoesEditorSidebar();
        ajustarTamanhoTituloAlbum();
    }, { passive: true });
    recalcularDimensoesEditorSidebar();
});

// pwa e badges

// conta rascunhos
function obterContadorRascunhos() {
    const historico = getHistorico();
    return historico.filter(r => r.isDraft).length;
}

// atualiza bolinha de notificacao
function atualizarNotificacaoApp(contador) {
    if ('setAppBadge' in navigator) {
        if (contador > 0) {
            navigator.setAppBadge(contador)
                .catch(err => console.error("Erro ao aplicar badge:", err));
        } else {
            navigator.clearAppBadge()
                .catch(err => console.error("Erro ao limpar badge:", err));
        }
    }
}

// pede permissao de notificacao no ios
document.addEventListener('click', () => {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                console.log("Permissão de notificações concedida!");
                atualizarNotificacaoApp(obterContadorRascunhos());
            }
        });
    }
}, { once: true });

// registra service worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registrado com sucesso:', reg.scope))
            .catch(err => console.error('Erro ao registrar Service Worker:', err));
    });
}
