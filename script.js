
// variaveis de estado e globais

function getDefaultNota() {
    return (localStorage.getItem("rating-scale") || "9") === "5" ? 0 : 1;
}

let estado = {
    id: "",
    album: "",
    artista: "",
    capa: "",
    link: "",
    albumNota: getDefaultNota(),
    albumNotaCalculada: 0,
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
        capa: "",
        link: "",
        albumNota: getDefaultNota(),
        albumNotaCalculada: 0,
        tracks: [],
        data: "",
        anotacoes: "",
    };
}

// funcoes auxiliares

// data de hoje formatada
function getDataHoje() {
    const hoje = new Date();
    const d = String(hoje.getDate()).padStart(2, "0");
    const m = String(hoje.getMonth() + 1).padStart(2, "0");
    const y = hoje.getFullYear();
    return `${d}/${m}/${y}`;
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
    estado = clonar ? { ...rev } : rev;
    switchView("reviews");
    isFirstLoad = true;
    render();
}

// deleta review sem confirmar
function deletarReviewSemConfirmacao(revId, revAlbum, revArtista) {
    const origHistorico = getHistorico();
    const origIndex = origHistorico.findIndex(r => r.id === revId || (r.album === revAlbum && r.artista === revArtista));
    if (origIndex !== -1) {
        origHistorico.splice(origIndex, 1);
        salvarHistorico(origHistorico);
    }
    if (estado.id === revId) {
        estado = getEmptyState();
        render();
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
        let historico = getHistorico();
        const index = historico.findIndex((r) => r.id === data.id || (r.album === data.name && r.artista === artistNames));

        if (index !== -1) {
            estado = { ...historico[index] };
        } else {
            estado = {
                id: data.id,
                album: data.name,
                artista: artistNames,
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
                data: "",
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

// renderiza o editor

// desenha a tela do editor
function render() {
    const header = document.getElementById("header");
    const tracksDiv = document.getElementById("tracks");
    const actionsDiv = document.getElementById("album-actions");
    const placeholder = document.getElementById("placeholder");
    const notesContainer = document.getElementById("notes-container");

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
        if (notesContainer) notesContainer.style.display = "block";
        actionsDiv.style.display = "grid";
        placeholder.style.display = "none";
    } else {
        header.style.display = "none";
        tracksDiv.style.display = "none";
        if (notesContainer) notesContainer.style.display = "none";
        actionsDiv.style.display = "none";
        placeholder.style.display = "block";
    }

    const reviewNotes = document.getElementById("review-notes");
    if (reviewNotes) {
        reviewNotes.value = estado.anotacoes || "";

        const autoResize = () => {
            reviewNotes.style.height = "auto";
            reviewNotes.style.height = reviewNotes.scrollHeight + "px";
        };

        setTimeout(autoResize, 0);

        reviewNotes.oninput = (e) => {
            estado.anotacoes = e.target.value;
            autoResize();
            autoSaveDraft();
        };
    }

    document.getElementById("titulo").textContent = estado.album;
    document.getElementById("artista").textContent = estado.artista;

    const metaInfo = document.getElementById("album-meta-info");
    if (metaInfo) {
        const totalTracks = estado.tracks ? estado.tracks.length : 0;
        const totalDurationMs = calcularDuracaoTotal(estado.tracks);
        if (totalTracks > 0) {
            const formattedDuration = formatarTempoTotal(totalDurationMs);
            const durationPart = formattedDuration ? ` • ${formattedDuration}` : "";
            metaInfo.textContent = `${totalTracks} ${totalTracks === 1 ? 'música' : 'músicas'}${durationPart}`;
            metaInfo.style.display = "block";
        } else {
            metaInfo.style.display = "none";
        }
    }

    if (!estado.data) {
        estado.data = getDataHoje();
    }

    const capa = document.getElementById("capa");
    capa.src = estado.capa || "";
    capa.style.cursor = "pointer";
    capa.onclick = () => { if (estado.link) window.open(estado.link, "_blank"); };

    atualizarFundo(estado.capa);

    const maxScoreLabel = getMaxScoreLabel();
    const autoCalc = getAutoCalculateMode() !== "desativado";

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
            if (autoCalc) return;
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
            if (getAutoCalculateMode() !== "desativado") {
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
    const index = historico.findIndex((r) => r.id === estado.id || (r.album === estado.album && r.artista === estado.artista));

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

    const btn = document.getElementById("btn-salvar");
    if (btn) {
        const textoOriginal = "salvar review";
        btn.textContent = "salvo!!!";
        setTimeout(() => {
            btn.textContent = textoOriginal;
        }, 2000);
    }
}

// desenha historico lateral
function carregarHistorico() {
    const container = document.getElementById("historico");
    if (!container) return;
    container.innerHTML = "";

    const historico = getHistorico();

    historico.sort((a, b) => {
        const diff = getSortableDate(b.data) - getSortableDate(a.data);
        return diff !== 0 ? diff : ((b.createdAt || 0) - (a.createdAt || 0));
    });

    historico.forEach((rev) => {
        const wrapper = document.createElement("div");
        wrapper.className = "review-wrapper";

        const div = document.createElement("div");
        div.className = `review-item ${estado.id === rev.id ? "active-review" : ""} ${rev.isDraft ? "draft-review" : ""}`;

        const texto = document.createElement("span");
        texto.textContent = rev.isDraft ? `${rev.album} (rascunho)` : `${rev.album} (${rev.data})`;

        div.onclick = () => {
            if (estado.id === rev.id) {
                navegarParaReview(getEmptyState());
            } else {
                navegarParaReview(rev, true);
            }
        };

        const del = document.createElement("span");
        del.innerHTML = `<svg class="close-icon" viewBox="0 0 24 24" width="12" height="12"><use href="icons/sprite.svg#icon-close"></use></svg>`;
        del.className = "delete-btn";
        del.onclick = (e) => {
            e.stopPropagation();
            deletarReviewSemConfirmacao(rev.id, rev.album, rev.artista);
            carregarHistorico();
        };

        div.append(texto, del);
        wrapper.appendChild(div);
        container.appendChild(wrapper);
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
    const dataMatch = lines[0].match(/-\s+(\d{2}\/\d{2}\/\d{2,4})/);
    if (dataMatch) {
        dataImportada = dataMatch[1];
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
    let historico = getHistorico();
    const index = historico.findIndex((r) => r.id === data.id || (r.album === data.name && r.artista === artistNames));

    estado = {
        id: data.id,
        album: data.name,
        artista: artistNames,
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

    lines.forEach(line => {
        const match = line.match(/^(?:\d+[\.\s-]+)?(.*?)\s+[-–—]\s+([\d.,]+)\/(9|5)\s*(👑)?/);
        if (match) {
            const trackName = match[1].trim();
            let nota = parseFloat(match[2].replace(',', '.'));
            const max = parseInt(match[3], 10);
            const fav = !!match[4];

            if (max === 5) {
                nota = deEscala(nota);
            }

            const normalize = (str) => {
                return str
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^a-z0-9]/g, "");
            };

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
        }
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

    if (getAutoCalculateMode() !== "desativado") {
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
    return localStorage.getItem("rating-scale") || "9";
}

// salva preferenca de escala
function setRatingScale(scale) {
    localStorage.setItem("rating-scale", scale);
}

// pega modo de calculo da media
function getAutoCalculateMode() {
    return localStorage.getItem("auto-calculate-rating") || "desativado";
}

// salva modo de calculo da media
function setAutoCalculateMode(mode) {
    localStorage.setItem("auto-calculate-rating", mode);
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

// pega nota efetiva do album
function getEffectiveAlbumNota(rev) {
    if (!rev) return 0;
    const calcMode = getAutoCalculateMode();
    if (calcMode === "simples") {
        if (rev.albumNotaCalculada !== undefined) {
            return rev.albumNotaCalculada;
        }
        if (rev.tracks && rev.tracks.length > 0) {
            const ratedTracks = rev.tracks.filter(t => t.nota > 0);
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

    const calcMode = getAutoCalculateMode();
    if (calcMode !== "simples") return;

    const ratedTracks = estado.tracks.filter(t => t.nota > 0);
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
    if (value !== "desativado" && estado.id) {
        recalcularNotaAlbum();
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
    document.querySelectorAll('.app-view').forEach(view => {
        view.style.display = 'none';
    });

    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) {
        targetView.style.display = 'block';
    }

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    const activeNav = document.getElementById(`nav-${viewName}`);
    if (activeNav) {
        activeNav.classList.add('active');
    }

    if (viewName === 'dashboard') {
        renderDashboard();
    } else if (viewName === 'library') {
        renderLibrary();
    } else if (viewName === 'reviews') {
        render();
    }
}

// dashboard

// calcula metricas e desenha dashboard
function renderDashboard() {
    const historico = getHistorico().filter(r => !r.isDraft);

    // media das faixas para desempate
    const getMediaTracks = (r) => {
        if (!r.tracks || r.tracks.length === 0) return 0;
        const rated = r.tracks.filter(t => t.nota > 0);
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
    topContainer.innerHTML = "";

    if (topAlbums.length === 0) {
        topContainer.innerHTML = `<p class="empty-list-msg">nenhum álbum avaliado ainda!!!</p>`;
    } else {
        topAlbums.forEach((rev, index) => {
            const item = document.createElement("div");
            item.className = "dash-top-album-item";

            const img = document.createElement("img");
            img.src = rev.capa || "";
            img.className = "dash-top-album-cover";

            const info = document.createElement("div");
            info.className = "dash-top-album-info";

            const title = document.createElement("span");
            title.className = "dash-top-album-title";
            title.textContent = `${index + 1}. ${rev.album}`;

            const artist = document.createElement("span");
            artist.className = "dash-top-album-artist";
            artist.textContent = rev.artista;

            info.append(title, artist);

            const score = document.createElement("span");
            score.className = "dash-top-album-score";
            const maxScore = getMaxScoreLabel();
            score.textContent = `${aEscala(getEffectiveAlbumNota(rev))}${maxScore}`;

            item.append(img, info, score);

            item.onclick = () => {
                navegarParaReview(rev);
            };

            topContainer.appendChild(item);
        });
    }

    const favListEl = document.getElementById("dash-favorites-list");
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
        const latestFavorites = favorites.slice(0, 5);
        if (latestFavorites.length === 0) {
            favListEl.innerHTML = `<p class="empty-list-msg">nenhuma música favorita marcada ainda!!!</p>`;
        } else {
            latestFavorites.forEach(fav => {
                const item = document.createElement("div");
                item.className = "dash-fav-track-item";

                const img = document.createElement("img");
                img.src = fav.capa || "";
                img.className = "dash-fav-track-cover";

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
                crown.className = "dash-fav-crown";
                crown.innerHTML = `
                    <svg class="crown-icon" width="16" height="16"><use href="icons/sprite.svg#icon-crown"></use></svg>
                `;

                item.append(img, info, crown);

                item.onclick = () => {
                    navegarParaReview(fav.review);
                };

                favListEl.appendChild(item);
            });
        }
    }
}

// biblioteca

// inverte direcao de ordenacao
function toggleLibrarySortOrder() {
    librarySortDesc = !librarySortDesc;

    const icon = document.getElementById("sort-order-icon");
    if (icon) {
        if (librarySortDesc) {
            icon.innerHTML = `<path d="M12 5v14M19 12l-7 7-7-7"/>`;
        } else {
            icon.innerHTML = `<path d="M12 19V5M5 12l7-7 7 7"/>`;
        }
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
        libraryGrid.innerHTML = `<p class="empty-library-msg">sua biblioteca está vazia. crie uma review na aba "reviews" para começar!</p>`;
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
        date.textContent = rev.isDraft ? "" : (rev.data || "-");

        metaRow.append(score, date);

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

// inicializacao

document.addEventListener("DOMContentLoaded", () => {
    applyLibraryLayout();
    carregarHistorico();
    inicializarControlesSegmentados();
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
