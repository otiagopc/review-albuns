// ===== ESTADO GLOBAL =====
function getEmptyState() {
    return {
        id: "",
        album: "",
        artista: "",
        capa: "",
        link: "",
        albumNota: 0,
        albumNotaCalculada: 0,
        tracks: [],
        data: "",
        anotacoes: "",
    };
}

let estado = getEmptyState();
let activeBg = 1;
let currentCapa = "";
let librarySortDesc = true;
let isFirstLoad = false;

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

// ===== DURAÇÃO HELPERS =====
function formatarTempo(ms) {
    if (!ms) return "";
    const totalSegundos = Math.floor(ms / 1000);
    const minutos = Math.floor(totalSegundos / 60);
    const segundos = totalSegundos % 60;
    return `${minutos}:${segundos.toString().padStart(2, '0')}`;
}

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

function calcularDuracaoTotal(tracks) {
    if (!tracks || !Array.isArray(tracks)) return 0;
    return tracks.reduce((sum, t) => sum + (t.duration_ms || 0), 0);
}


// ===== UI & LOADING =====
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

// ===== API & DADOS =====
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
                albumNota: 0,
                albumNotaCalculada: 0,
                tracks: data.tracks.items.map((t) => ({
                    nome: t.name,
                    nota: 0,
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
        switchView('reviews');
        isFirstLoad = true;
        render();
    } catch (err) {
        setLoading(false);
        render();
        alert(`erro ao buscar album: ${err.message}. verifique o link ou se as credenciais da API do Spotify em .env.local estão configuradas corretamente.`);
        console.error(err);
    }
}

// ===== FUNDO & UI =====
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

// ===== COMPONENTES =====
function criarEstrelas(container, valorAtual, onClick, isAlbum = false) {
    container.innerHTML = "";
    const stars = [];
    const scale = getRatingScale();
    const maxStars = scale === "5" ? 5 : 9;
    const permiteMeia = (scale === "5") || !isAlbum;

    // Criar os elementos visuais das estrelas
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

    // Calcular o valor com base na coordenada horizontal do ponteiro
    function calcularValor(clientX) {
        if (stars.length === 0) return 0;
        const firstRect = stars[0].getBoundingClientRect();
        const lastRect = stars[stars.length - 1].getBoundingClientRect();

        if (clientX < firstRect.left) {
            return 0;
        }
        if (clientX > lastRect.right) {
            return maxStars;
        }

        // Tenta encontrar a estrela específica sob o ponteiro
        for (let idx = 0; idx < stars.length; idx++) {
            const rect = stars[idx].getBoundingClientRect();
            if (clientX >= rect.left && clientX <= rect.right) {
                if (!permiteMeia) {
                    return idx + 1;
                } else {
                    const relativeX = clientX - rect.left;
                    return relativeX < rect.width / 2 ? idx + 0.5 : idx + 1;
                }
            }
        }

        // Fallback: calcula qual estrela está mais próxima caso esteja no espaço entre estrelas (gaps)
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
            return closestIdx + 1;
        } else {
            const rect = stars[closestIdx].getBoundingClientRect();
            const relativeX = clientX - rect.left;
            return relativeX < rect.width / 2 ? closestIdx + 0.5 : closestIdx + 1;
        }
    }

    // Configurar o contêiner para não scrollar no mobile ao arrastar nas estrelas
    container.style.touchAction = "none";
    container.style.userSelect = "none";
    container.style.webkitUserSelect = "none";

    let isDragging = false;
    let lastValue = valorAtual;

    container.onpointerdown = (e) => {
        // Ignora se for clique na coroa
        if (e.target && e.target.closest('.crown-btn')) return;
        // Ignora se o clique for fora dos limites físicos das estrelas
        const firstRect = stars[0].getBoundingClientRect();
        const lastRect = stars[stars.length - 1].getBoundingClientRect();
        const starsTop = firstRect.top;
        const starsBottom = firstRect.bottom;
        if (e.clientX < firstRect.left || e.clientX > lastRect.right ||
            e.clientY < starsTop || e.clientY > starsBottom) return;
        // Aceita apenas clique esquerdo do mouse ou interações touch
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
                // Preview de hover padrão
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

// ===== RENDER =====
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

        // Ajusta o tamanho inicial se já houver texto (ex: ao importar)
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


    const dateInput = document.getElementById("review-date");
    if (dateInput) {
        if (!estado.data) {
            const hoje = new Date();
            const y = hoje.getFullYear();
            const m = String(hoje.getMonth() + 1).padStart(2, '0');
            const d = String(hoje.getDate()).padStart(2, '0');
            estado.data = `${d}/${m}/${y}`;
        }
        dateInput.value = estado.data;
    }

    const capa = document.getElementById("capa");
    capa.src = estado.capa || "";
    capa.style.cursor = "pointer";
    capa.onclick = () => { if (estado.link) window.open(estado.link, "_blank"); };

    atualizarFundo(estado.capa);

    const ratingScale = getRatingScale();
    const maxScoreLabel = ratingScale === "5" ? "/5" : "/9";
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
        const notaExibida = formatarNotaExibicao(getEffectiveAlbumNota(estado));
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
                track.nota = 0;
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
            <svg class="crown-icon" viewBox="0 0 24 24" width="16" height="16">
              <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/>
            </svg>
        `;
        crown.onclick = () => {
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

// ===== STORAGE & HISTÓRICO =====
function getHistorico() {
    return JSON.parse(localStorage.getItem("reviews")) || [];
}

function salvarHistorico(historico) {
    localStorage.setItem("reviews", JSON.stringify(historico));
}

function getSortableDate(dateStr) {
    if (!dateStr) return 0;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return 0;
    const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
    return parseInt(`${y}${parts[1]}${parts[0]}`, 10);
}

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

function carregarHistorico() {
    const container = document.getElementById("historico");
    container.innerHTML = "";

    const historico = getHistorico();

    // Ordena o histórico por data decrescente (mais recente primeiro)
    historico.sort((a, b) => {
        const diff = getSortableDate(b.data) - getSortableDate(a.data);
        return diff !== 0 ? diff : ((b.createdAt || 0) - (a.createdAt || 0));
    });

    historico.forEach((rev, index) => {
        const wrapper = document.createElement("div");
        wrapper.className = "review-wrapper";

        const div = document.createElement("div");
        div.className = `review-item ${estado.id === rev.id ? "active-review" : ""} ${rev.isDraft ? "draft-review" : ""}`;

        const texto = document.createElement("span");
        texto.textContent = rev.isDraft ? `${rev.album} (rascunho)` : `${rev.album} (${rev.data})`;

        div.onclick = () => {
            if (estado.id === rev.id) {
                estado = getEmptyState();
            } else {
                estado = { ...rev };
            }
            switchView('reviews');
            isFirstLoad = true;
            render();
        };

        const del = document.createElement("span");
        del.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
        del.className = "delete-btn";
        del.onclick = (e) => {
            e.stopPropagation();

            let origHistorico = getHistorico();
            const origIndex = origHistorico.findIndex(r => r.id === rev.id || (r.album === rev.album && r.artista === rev.artista));
            if (origIndex !== -1) {
                origHistorico.splice(origIndex, 1);
                salvarHistorico(origHistorico);
            }
            carregarHistorico();

            // Se deletou o álbum atual, limpa a tela
            if (estado.id === rev.id) {
                estado = getEmptyState();
                render();
            }
        };

        div.append(texto, del);
        wrapper.appendChild(div);
        container.appendChild(wrapper);
    });
}

// ===== EXPORT & COPIAR =====
function gerarTextoReview() {
    if (!estado.id) return "";

    let dataReview = estado.data;
    if (!dataReview) {
        const hoje = new Date();
        dataReview = `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`;
    }
    let texto = `-${estado.album}- ${dataReview}\n\n`;

    const ratingScale = getRatingScale();
    const maxLabel = ratingScale === "5" ? "/5" : "/9";

    estado.tracks.forEach((t, i) => {
        texto += `${i + 1}. ${t.nome} - ${formatarNotaExibicao(t.nota)}${maxLabel} ${t.fav ? "👑" : ""}\n`;
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

function exportarTXT() {
    const texto = gerarTextoReview();
    if (!texto) return alert("nenhum album para exportar!!!");

    const blob = new Blob([texto], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${estado.album}.txt`;
    a.click();

    const btn = document.getElementById("btn-exportar");
    if (btn) {
        const textoOriginal = "exportar review";
        btn.textContent = "exportado!!!";
        setTimeout(() => {
            btn.textContent = textoOriginal;
        }, 2000);
    }
}


// ===== AUTO-REPARAÇÃO EM SEGUNDO PLANO =====
async function repararReview(rev) {
    const temDuracao = rev.tracks && rev.tracks.length > 0 && rev.tracks[0].duration_ms !== undefined;
    if (temDuracao) return rev;

    try {
        const url = rev.link;
        if (!url) return rev;

        const res = await fetch(`/api/album?url=${encodeURIComponent(url)}`);
        if (!res.ok) return rev;
        const data = await res.json();

        // Se a API retornou erro (ex: credenciais inválidas ou limite excedido),
        // não marca como reparado para permitir retentar depois que corrigir as credenciais
        if (data.error) {
            console.warn(`[Reparo] Não foi possível reparar o álbum "${rev.album}":`, data.error.message);
            return rev;
        }

        // Repara durações das tracks
        if (rev.tracks && Array.isArray(rev.tracks) && data.tracks && data.tracks.items) {
            rev.tracks.forEach((track) => {
                const matchingTrack = data.tracks.items.find(t => t.name === track.nome);
                if (matchingTrack) {
                    track.duration_ms = matchingTrack.duration_ms || 0;
                }
            });
        }

        // Repara ID se necessário
        if (!rev.id) {
            rev.id = data.id;
        }

        return rev;
    } catch (e) {
        console.error("Erro ao auto-reparar review:", e);
        return rev;
    }
}

async function repararTudoNoBackground() {
    let historico = getHistorico();
    let mudou = false;

    for (let i = 0; i < historico.length; i++) {
        const rev = historico[i];
        const temDuracao = rev.tracks && rev.tracks.length > 0 && rev.tracks[0].duration_ms !== undefined;

        if (!temDuracao) {
            const revReparada = await repararReview(rev);
            historico[i] = revReparada;
            mudou = true;
            salvarHistorico(historico);
        }
    }

    if (mudou) {
        // Re-renderiza biblioteca e histórico apenas uma vez no final se houve mudanças
        renderLibrary();
        carregarHistorico();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // Sincroniza o estado inicial do sistema de avaliação
    const selectScale = document.getElementById("settings-rating-scale");
    if (selectScale) {
        selectScale.value = getRatingScale();
    }
    const selectAuto = document.getElementById("settings-auto-calculate");
    if (selectAuto) {
        selectAuto.value = getAutoCalculateMode();
    }

    applyVisualSettings();
    applyLibraryLayout();
    carregarHistorico();
    inicializarControlesCustomizados();
    switchView('library');
    repararTudoNoBackground();
});

// ===== SISTEMA DE AVALIAÇÃO (HELPERS & PERSISTÊNCIA) =====
function getRatingScale() {
    return localStorage.getItem("rating-scale") || "9";
}

function setRatingScale(scale) {
    localStorage.setItem("rating-scale", scale);
}

function getAutoCalculateMode() {
    return localStorage.getItem("auto-calculate-rating") || "desativado";
}

function setAutoCalculateMode(mode) {
    localStorage.setItem("auto-calculate-rating", mode);
}

function aEscala(nota, isAlbum = false) {
    if (nota === undefined || nota === null) return 0;
    const scale = getRatingScale();
    if (scale === "5") {
        const nota5 = (nota * 5) / 9;
        return Math.round(nota5 * 2) / 2; // Arredonda para o 0.5 mais próximo
    }
    // Escala 9
    if (isAlbum) {
        return Math.round(nota); // Álbum na escala 9 só tem estrelas inteiras
    }
    return Math.round(nota * 2) / 2; // Faixas suportam meias estrelas
}

function aEscalaProporcional(nota) {
    if (nota === undefined || nota === null) return 0;
    const scale = getRatingScale();
    if (scale === "5") {
        return (nota * 5) / 9;
    }
    return nota;
}

function deEscala(notaVal) {
    if (notaVal === undefined || notaVal === null) return 0;
    const scale = getRatingScale();
    if (scale === "5") {
        const nota9 = (notaVal * 9) / 5;
        return Math.round(nota9 * 2) / 2; // Arredonda para o 0.5 mais próximo
    }
    return notaVal;
}

function formatarNotaExibicao(nota) {
    if (nota === undefined || nota === null) return 0;
    const scale = getRatingScale();
    const val = scale === "5" ? (nota * 5) / 9 : nota;
    return Math.round(val * 2) / 2; // Arredonda para o 0.5 mais próximo
}

function getEffectiveAlbumNota(rev) {
    if (!rev) return 0;
    const calcMode = getAutoCalculateMode();
    if (calcMode === "simples") {
        if (rev.albumNotaCalculada !== undefined) {
            return rev.albumNotaCalculada;
        }
        // Fallback para reviews antigas que não tem o campo
        if (rev.tracks && rev.tracks.length > 0) {
            const ratedTracks = rev.tracks.filter(t => (t.nota || 0) > 0);
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

function recalcularNotaAlbum() {
    if (!estado.tracks || estado.tracks.length === 0) return;

    const calcMode = getAutoCalculateMode();
    if (calcMode !== "simples") return;

    const ratedTracks = estado.tracks.filter(t => (t.nota || 0) > 0);
    if (ratedTracks.length === 0) {
        estado.albumNotaCalculada = 0;
        return;
    }

    const sum = ratedTracks.reduce((sum, t) => sum + (t.nota || 0), 0);
    const media = sum / ratedTracks.length;
    estado.albumNotaCalculada = Math.round(media * 2) / 2; // Arredonda para o 0.5 mais próximo
}

function updateRatingScaleSettings() {
    const select = document.getElementById("settings-rating-scale");
    if (select) {
        setRatingScale(select.value);
        render();
        renderLibrary();
        renderDashboard();
    }
}

// Vincula o evento global
function updateAutoCalculateSettings() {
    const select = document.getElementById("settings-auto-calculate");
    if (select) {
        setAutoCalculateMode(select.value);
        if (select.value !== "desativado" && estado.id) {
            recalcularNotaAlbum();
        }
        render();
        renderLibrary();
    }
}

// ===== APARÊNCIA & TEMAS =====
function getVisualSettings() {
    const defaults = {
        blur: 40,
        opacity: 40,
        accentHue: 141,
        glow: true
    };
    return { ...defaults, ...JSON.parse(localStorage.getItem("visual-settings") || "{}") };
}

function saveVisualSettings(settings) {
    localStorage.setItem("visual-settings", JSON.stringify(settings));
}



function applyVisualSettings() {
    const settings = getVisualSettings();

    // 1. Aplicar desfoque (blur) e overlay (brightness)
    document.documentElement.style.setProperty('--bg-blur', `${settings.blur}px`);
    const brightness = 1 - (settings.opacity / 100);
    document.documentElement.style.setProperty('--bg-brightness', brightness);

    // 2. Aplicar cor de destaque
    const accentColors = {
        141: "29, 185, 84", // Spotify Verde
        270: "135, 50, 230", // Roxo Sintetizador
        200: "30, 144, 255", // Azul Cyberpunk
        330: "255, 20, 147", // Rosa Neon
        25: "255, 100, 30" // Laranja Vinil
    };
    const rgb = accentColors[settings.accentHue] || "29, 185, 84";
    document.documentElement.style.setProperty('--hue-primary', settings.accentHue);
    document.documentElement.style.setProperty('--color-primary-rgb', rgb);

    // 3. Aplicar Glow
    if (settings.glow) {
        document.documentElement.style.setProperty('--glow-alpha-low', '0.25');
        document.documentElement.style.setProperty('--glow-alpha-medium', '0.5');
        document.documentElement.style.setProperty('--glow-alpha-high', '0.75');
        document.documentElement.style.setProperty('--glow-alpha-max', '1.0');
    } else {
        document.documentElement.style.setProperty('--glow-alpha-low', '0');
        document.documentElement.style.setProperty('--glow-alpha-medium', '0');
        document.documentElement.style.setProperty('--glow-alpha-high', '0');
        document.documentElement.style.setProperty('--glow-alpha-max', '0');
    }

    // 4. Sincronizar UI se os elementos existirem na aba ativa
    syncVisualSettingsUI(settings);
}

function syncVisualSettingsUI(settings) {
    const inputBlur = document.getElementById("settings-blur");
    const valBlur = document.getElementById("val-blur");
    if (inputBlur && valBlur) {
        inputBlur.value = settings.blur;
        valBlur.textContent = `${settings.blur}px`;
    }

    const inputOpacity = document.getElementById("settings-opacity");
    const valOpacity = document.getElementById("val-opacity");
    if (inputOpacity && valOpacity) {
        inputOpacity.value = settings.opacity;
        valOpacity.textContent = `${settings.opacity}%`;
    }

    const inputGlow = document.getElementById("settings-glow");
    if (inputGlow) {
        inputGlow.checked = settings.glow;
    }

    document.querySelectorAll(".theme-dot").forEach(btn => {
        const hue = parseInt(btn.getAttribute("data-hue"), 10);
        if (hue === settings.accentHue) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });
}

function updateVisualSettings() {
    const inputBlur = document.getElementById("settings-blur");
    const inputOpacity = document.getElementById("settings-opacity");
    const inputGlow = document.getElementById("settings-glow");

    if (!inputBlur || !inputOpacity || !inputGlow) return;

    const blur = parseInt(inputBlur.value, 10);
    const opacity = parseInt(inputOpacity.value, 10);
    const glow = inputGlow.checked;

    const currentSettings = getVisualSettings();
    const newSettings = {
        ...currentSettings,
        blur,
        opacity,
        glow
    };

    saveVisualSettings(newSettings);
    applyVisualSettings();
}

function setAccentColor(hue, btnElement) {
    const currentSettings = getVisualSettings();
    const newSettings = {
        ...currentSettings,
        accentHue: parseInt(hue, 10)
    };

    saveVisualSettings(newSettings);
    applyVisualSettings();
}

function getLibraryLayout() {
    return localStorage.getItem("library-layout") || "grid";
}

function setLibraryLayout(layout) {
    localStorage.setItem("library-layout", layout);
    applyLibraryLayout();
}

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

// ===== IMPORTAR =====
async function processarTextoReviewImportado(text) {
    if (!text || text.trim() === "") {
        throw new Error("o texto da review está vazio!!!");
    }
    const lines = text.split('\n');
    let urlLine = "";

    // Procura o link do Spotify nas últimas linhas
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
        albumNota: 0,
        albumNotaCalculada: 0,
        tracks: data.tracks.items.map((t) => ({
            nome: t.name,
            nota: 0,
            fav: false,
            duration_ms: t.duration_ms || 0,
        })),
        data: dataImportada,
        anotacoes: anotacoesImportadas,
        isDraft: index !== -1 ? (historico[index].isDraft !== undefined ? historico[index].isDraft : true) : true,
        createdAt: index !== -1 ? (historico[index].createdAt || Date.now()) : Date.now()
    };

    // Lê as notas de cada faixa
    lines.forEach(line => {
        const match = line.match(/^\d+\.\s+(.+?)\s+-\s+([\d.]+)\/(9|5)\s*(👑)?/);
        if (match) {
            const trackName = match[1];
            let nota = parseFloat(match[2]);
            const max = parseInt(match[3], 10);
            const fav = !!match[4];

            if (max === 5) {
                nota = deEscala(nota);
            }

            const trackIndex = estado.tracks.findIndex(t => t.nome === trackName);
            if (trackIndex !== -1) {
                estado.tracks[trackIndex].nota = nota;
                estado.tracks[trackIndex].fav = fav;
            }
        }
    });

    // Lê a nota geral do álbum (estrelas)
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

    // Calcula a nota automática do álbum se a configuração estiver ativa
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

    switchView('reviews');
    isFirstLoad = true;
    render();
}

async function importarTXT(event) {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);

    try {
        const text = await file.text();
        event.target.value = ""; // limpa o input para permitir importar o mesmo arquivo depois
        await processarTextoReviewImportado(text);
        setLoading(false);
    } catch (err) {
        setLoading(false);
        render();
        alert(`erro ao importar review: ${err.message}. verifique se o link ainda é valido ou as credenciais da API do Spotify em .env.local.`);
        console.error(err);
    }
}

// ===== BACKUP COMPLETO =====
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

// ===== VIEWS (SPA NAVEGAÇÃO) & VIEWS RENDER =====

function switchView(viewName) {
    // Esconde todas as visualizações
    document.querySelectorAll('.app-view').forEach(view => {
        view.style.display = 'none';
    });

    // Exibe a visualização ativa
    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) {
        targetView.style.display = 'block';
    }

    // Atualiza a classe ativa no menu lateral
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    const activeNav = document.getElementById(`nav-${viewName}`);
    if (activeNav) {
        activeNav.classList.add('active');
    }

    // Renderiza o conteúdo da aba selecionada
    if (viewName === 'dashboard') {
        renderDashboard();
    } else if (viewName === 'library') {
        renderLibrary();
    } else if (viewName === 'reviews') {
        render();
    } else if (viewName === 'settings') {
        syncVisualSettingsUI(getVisualSettings());
    }
}

function renderDashboard() {
    const historico = getHistorico().filter(r => !r.isDraft);

    // 1. Quantidade total
    const totalAlbums = historico.length;
    document.getElementById("dash-total-reviews").textContent = totalAlbums;

    // 2. Média geral de notas
    let sumNotas = 0;
    historico.forEach(r => {
        sumNotas += (getEffectiveAlbumNota(r) || 0);
    });
    const mediaGeral = totalAlbums > 0 ? formatarNotaExibicao(sumNotas / totalAlbums).toFixed(1) : "0.0";
    document.getElementById("dash-average-score").textContent = mediaGeral;

    // 3. Artista mais ouvido
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

    // 3.1. Músicas Avaliadas, Tempo Total, Melhor Avaliado e Lista de Favoritas
    let totalTracks = 0;
    let totalFavTracks = 0;
    let totalDurationMs = 0;
    let bestAlbum = null;
    let maxNota = -1;
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
        if (getEffectiveAlbumNota(r) > maxNota) {
            maxNota = getEffectiveAlbumNota(r);
            bestAlbum = r;
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
            const scale = getRatingScale();
            const maxScore = scale === "5" ? "/5" : "/9";
            const displayStr = `${bestAlbum.album} (${formatarNotaExibicao(getEffectiveAlbumNota(bestAlbum))}${maxScore})`;
            bestAlbumEl.textContent = displayStr;
            bestAlbumEl.title = displayStr;
        } else {
            bestAlbumEl.textContent = "-";
            bestAlbumEl.title = "";
        }
    }

    // 4. Distribuição de Notas (Gráfico de Barras Vertical com Eixo Y e Grid Lines)
    const scale = getRatingScale();
    const maxStars = scale === "5" ? 5 : 9;
    const isBase5 = (scale === "5");

    // Gerar lista de valores possíveis dependendo da escala ativa
    const ratingValues = [];
    const stepVal = isBase5 ? 0.5 : 1;
    for (let val = stepVal; val <= maxStars; val += stepVal) {
        ratingValues.push(val);
    }

    // Inicializa a contagem para cada valor possível
    const counts = {};
    ratingValues.forEach(val => {
        counts[val] = 0;
    });

    historico.forEach(r => {
        const rawNote = aEscalaProporcional(getEffectiveAlbumNota(r));
        const note = isBase5 ? (Math.round(rawNote * 2) / 2) : Math.round(rawNote);
        if (counts[note] !== undefined) {
            counts[note]++;
        }
    });

    const maxRatingCountRaw = Math.max(...Object.values(counts), 1);

    // Escolhe o melhor tamanho de passo (1, 2, 5, 10, 20, 50, etc.)
    // para que a quantidade de divisões/ticks no eixo Y fique entre 2 e 5.
    const steps = [1, 2, 5, 10, 20, 50, 100, 250, 500, 1000];
    let step = 1;
    for (const s of steps) {
        if (Math.ceil(maxRatingCountRaw / s) <= 5) {
            step = s;
            break;
        }
    }

    // O valor máximo do gráfico será o próximo múltiplo do passo escolhido
    const chartMaxVal = Math.ceil(maxRatingCountRaw / step) * step;

    // Gerar ticks do Eixo Y e Linhas de Grade dinamicamente
    const yAxisContainer = document.getElementById("chart-y-axis");
    const gridLinesContainer = document.getElementById("chart-grid-lines");

    if (yAxisContainer && gridLinesContainer) {
        yAxisContainer.innerHTML = "";
        gridLinesContainer.innerHTML = "";

        // Gerar os ticks de 0 até chartMaxVal de step em step
        const ticks = [];
        for (let val = 0; val <= chartMaxVal; val += step) {
            ticks.push(val);
        }

        ticks.forEach(val => {
            const pct = (val / chartMaxVal) * 100;

            // Marcação no Eixo Y
            const tick = document.createElement("span");
            tick.className = "chart-y-axis-tick";
            tick.style.bottom = `${pct}%`;
            tick.textContent = val;
            yAxisContainer.appendChild(tick);

            // Linha de grade horizontal
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
        bar.style.height = `0%`; // Inicia em 0% para animação

        const label = document.createElement("span");
        label.className = "chart-label";
        label.textContent = val;

        barWrapper.appendChild(bar);
        col.append(barWrapper, label);
        chartContainer.appendChild(col);

        // Trigger de animação de entrada com pequeno delay
        setTimeout(() => {
            bar.style.height = `${pct}%`;
        }, 50);
    });

    // 5. Top 10 Álbuns
    const topAlbums = [...historico]
        .sort((a, b) => (getEffectiveAlbumNota(b) || 0) - (getEffectiveAlbumNota(a) || 0))
        .slice(0, 10);

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
            const maxScore = getRatingScale() === "5" ? "/5" : "/9";
            score.textContent = `${formatarNotaExibicao(getEffectiveAlbumNota(rev))}${maxScore}`;

            item.append(img, info, score);

            item.onclick = () => {
                estado = rev;
                switchView('reviews');
                isFirstLoad = true;
                render();
            };

            topContainer.appendChild(item);
        });
    }

    // 6. Painel de Músicas Favoritas
    const favListEl = document.getElementById("dash-favorites-list");
    if (favListEl) {
        favListEl.innerHTML = "";
        favorites.sort((a, b) => (b.nota || 0) - (a.nota || 0));
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
                    <svg class="crown-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/>
                    </svg>
                `;

                item.append(img, info, crown);

                item.onclick = () => {
                    estado = fav.review;
                    switchView('reviews');
                    isFirstLoad = true;
                    render();
                };

                favListEl.appendChild(item);
            });
        }
    }
    adjustCardTextSizes();
}

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


function renderLibrary() {
    applyLibraryLayout();
    const libraryGrid = document.getElementById("library-grid");
    libraryGrid.innerHTML = "";

    const historico = getHistorico().filter(r => !r.isDraft);
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

    // ORDENAÇÃO
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
        card.className = "library-card animate-card";

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
        const maxScore = getRatingScale() === "5" ? "/5" : "/9";
        score.innerHTML = `<span class="score-star">★</span> ${formatarNotaExibicao(getEffectiveAlbumNota(rev))}${maxScore}`;

        const date = document.createElement("span");
        date.className = "library-card-date";
        date.textContent = rev.data || "-";

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

        // Botão de deletar no canto superior direito
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "library-card-delete-btn";
        deleteBtn.title = "Excluir review";
        deleteBtn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            if (confirm(`deseja realmente apagar a review de "${rev.album}"?`)) {
                let origHistorico = getHistorico();
                const origIndex = origHistorico.findIndex(r => r.id === rev.id || (r.album === rev.album && r.artista === rev.artista));
                if (origIndex !== -1) {
                    origHistorico.splice(origIndex, 1);
                    salvarHistorico(origHistorico);
                }
                renderLibrary();

                // Se deletou o álbum atual, limpa a tela
                if (estado.id === rev.id) {
                    estado = getEmptyState();
                    render();
                }
            }
        };
        card.appendChild(deleteBtn);

        card.onclick = () => {
            estado = rev;
            switchView('reviews');
            isFirstLoad = true;
            render();
        };

        libraryGrid.appendChild(card);
    });
}

function limparTudo() {
    if (confirm("ATENÇÃO: isso apagará permanentemente todas as suas reviews salvas! esta ação não pode ser desfeita. deseja continuar?")) {
        localStorage.removeItem("reviews");
        estado = getEmptyState();
        render();
        switchView('dashboard');
        alert("todos os dados foram apagados com sucesso!");
    }
}

// ===== CONTROLES CUSTOMIZADOS (DROPDOWN & INPUT DE DATA) =====

function inicializarControlesCustomizados() {
    // 1. DROPDOWNS CUSTOMIZADOS GERAIS
    document.querySelectorAll(".custom-select").forEach(customSel => {
        const nativeSel = customSel.previousElementSibling;
        if (!nativeSel || nativeSel.tagName !== "SELECT") return;

        const trigger = customSel.querySelector(".custom-select-trigger");
        if (!trigger) return;
        const triggerText = trigger.querySelector("span");
        const options = customSel.querySelectorAll(".custom-option");

        // Sincroniza estado inicial do trigger
        const selectedOpt = nativeSel.querySelector(`option[value="${nativeSel.value}"]`);
        if (selectedOpt && triggerText) {
            triggerText.textContent = selectedOpt.textContent;
            options.forEach(opt => {
                if (opt.getAttribute("data-value") === nativeSel.value) {
                    opt.classList.add("selected");
                } else {
                    opt.classList.remove("selected");
                }
            });
        }

        // Clique no trigger abre/fecha
        trigger.addEventListener("click", (e) => {
            e.stopPropagation();
            // Fecha outros dropdowns/datepickers
            document.querySelectorAll(".custom-select").forEach(cs => {
                if (cs !== customSel) cs.classList.remove("active");
            });
            customSel.classList.toggle("active");
        });

        // Clique nas opções
        options.forEach(opt => {
            opt.addEventListener("click", () => {
                const val = opt.getAttribute("data-value");
                nativeSel.value = val;

                // Atualiza classes selecionadas
                options.forEach(o => o.classList.remove("selected"));
                opt.classList.add("selected");
                if (triggerText) triggerText.textContent = opt.textContent;

                customSel.classList.remove("active");

                // Dispara evento de mudança no select nativo
                nativeSel.dispatchEvent(new Event("change"));
            });
        });
    });

    // 2. INPUT DE DATA MANUAL COM MÁSCARA E VALIDAÇÃO
    const dateInput = document.getElementById("review-date");
    if (dateInput) {
        // Função auxiliar para validar se a data inserida é um dia/mês/ano válido real
        const validarData = (dataStr) => {
            if (!dataStr || dataStr.length !== 10) return false;
            const parts = dataStr.split("/");
            if (parts.length !== 3) return false;
            const dia = parseInt(parts[0], 10);
            const mes = parseInt(parts[1], 10);
            const ano = parseInt(parts[2], 10);
            
            if (isNaN(dia) || isNaN(mes) || isNaN(ano)) return false;
            if (mes < 1 || mes > 12) return false;
            if (ano < 1000 || ano > 9999) return false;
            
            const diasNoMes = new Date(ano, mes, 0).getDate();
            if (dia < 1 || dia > diasNoMes) return false;
            
            return true;
        };

        // Função para formatar a data de hoje
        const obterDataHojeFormatada = () => {
            const hoje = new Date();
            const d = String(hoje.getDate()).padStart(2, '0');
            const m = String(hoje.getMonth() + 1).padStart(2, '0');
            const y = hoje.getFullYear();
            return `${d}/${m}/${y}`;
        };

        // Evento input para máscara automática DD/MM/AAAA
        dateInput.addEventListener("input", (e) => {
            let val = e.target.value.replace(/\D/g, "");
            if (val.length > 8) val = val.substring(0, 8);
            
            let formatted = "";
            if (val.length > 4) {
                formatted = `${val.substring(0, 2)}/${val.substring(2, 4)}/${val.substring(4)}`;
            } else if (val.length > 2) {
                formatted = `${val.substring(0, 2)}/${val.substring(2)}`;
            } else {
                formatted = val;
            }
            
            e.target.value = formatted;
            estado.data = formatted;
            autoSaveDraft();
        });

        // Evento blur para validar no focus out e retornar para hoje se inválido
        dateInput.addEventListener("blur", (e) => {
            if (!validarData(e.target.value)) {
                const hojeStr = obterDataHojeFormatada();
                e.target.value = hojeStr;
                estado.data = hojeStr;
                autoSaveDraft();
            }
        });
    }

    // Fechar ao clicar fora usando .contains()
    document.addEventListener("click", (e) => {
        document.querySelectorAll(".custom-select").forEach(cs => {
            if (!cs.contains(e.target)) {
                cs.classList.remove("active");
            }
        });
        document.querySelectorAll(".dropdown-wrapper").forEach(w => {
            if (!w.contains(e.target)) {
                w.classList.remove("active");
            }
        });
        
        // Fechar busca da biblioteca ao clicar fora
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
}

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

// ===== MENU DROPDOWN & CLIPBOARD ACTIONS =====
function toggleDropdown(event, id) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    const dropdownMenu = document.getElementById(id);
    if (!dropdownMenu) return;

    const wrapper = dropdownMenu.closest(".dropdown-wrapper");
    if (!wrapper) return;

    const isActive = wrapper.classList.contains("active");

    // Fecha outros dropdowns, datepickers ou custom-selects
    document.querySelectorAll(".dropdown-wrapper").forEach(w => {
        if (w !== wrapper) w.classList.remove("active");
    });
    document.querySelectorAll(".custom-select").forEach(cs => cs.classList.remove("active"));

    if (isActive) {
        wrapper.classList.remove("active");
    } else {
        wrapper.classList.add("active");
    }
}

async function colarReviewClipboard() {
    setLoading(true);
    try {
        const text = await navigator.clipboard.readText();
        await processarTextoReviewImportado(text);
        setLoading(false);
        // Fechar dropdowns
        document.querySelectorAll(".dropdown-wrapper").forEach(w => w.classList.remove("active"));
    } catch (err) {
        setLoading(false);
        render();
        alert(`erro ao colar review: ${err.message}. verifique se concedeu permissão de clipboard ao site.`);
        console.error(err);
    }
}

async function copiarReviewClipboard() {
    const texto = gerarTextoReview();
    if (!texto) return alert("nenhum album para copiar!!!");

    try {
        await navigator.clipboard.writeText(texto);
        
        const btnCopiar = document.getElementById("btn-copiar-item");
        if (btnCopiar) {
            const originalHTML = btnCopiar.innerHTML;
            // Exibir feedback "copiado!!!"
            btnCopiar.innerHTML = `
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--color-primary-light)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                copiado!!!
            `;
            setTimeout(() => {
                btnCopiar.innerHTML = originalHTML;
                // Fechar dropdowns
                document.querySelectorAll(".dropdown-wrapper").forEach(w => w.classList.remove("active"));
            }, 1500);
        }
    } catch (err) {
        alert("erro ao copiar review para a área de transferência!!!");
        console.error(err);
    }
}


function adjustCardTextSizes() {
    const topArtistEl = document.getElementById("dash-top-artist");
    const bestAlbumEl = document.getElementById("dash-best-album");
    const elements = [topArtistEl, bestAlbumEl].filter(Boolean);

    // Phase 1: Clear inline style to allow CSS clamp (container query units) to compute default size
    elements.forEach(el => {
        el.style.fontSize = "";
    });

    // Phase 2: Scale down font size step-by-step if it overflows
    elements.forEach(el => {
        if (el.clientHeight === 0) return; // If hidden, skip

        const computedStyle = window.getComputedStyle(el);
        const rootFontSize = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
        const currentFontSizePx = parseFloat(computedStyle.fontSize);
        if (!currentFontSizePx) return;

        let currentSizeRem = currentFontSizePx / rootFontSize;
        // Cap max size at 1.6rem
        if (currentSizeRem > 1.6) {
            currentSizeRem = 1.6;
        }

        el.style.fontSize = `${currentSizeRem}rem`;

        const minSizeRem = 1.15;
        const step = 0.03;
        let maxIterations = 20;

        // Shrink font size while scrollHeight > clientHeight (clamped to 2 lines)
        while (el.scrollHeight > el.clientHeight && currentSizeRem > minSizeRem && maxIterations > 0) {
            currentSizeRem = Math.max(minSizeRem, currentSizeRem - step);
            el.style.fontSize = `${currentSizeRem}rem`;
            maxIterations--;
        }
    });
}

// Adjust font sizes when window resizes and dashboard is active
window.addEventListener('resize', () => {
    const dashboardView = document.getElementById("view-dashboard");
    if (dashboardView && dashboardView.style.display !== 'none') {
        adjustCardTextSizes();
    }
});


