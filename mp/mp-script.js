let albumsData = []; // Здесь будем хранить данные из JSON

const audioPlayer = document.getElementById('main-audio');
const nowPlayingText = document.getElementById('now-playing');
const contentArea = document.getElementById('content-area');
const pageTitle = document.getElementById('page-title');
const albumHeader = document.getElementById('album-header');
const backBtn = document.getElementById('back-btn');

// Авто-конвертер ссылок (оставляем старый)
function getDirectLink(url) {
    if (url.includes('://google.com')) {
        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match) return `https://://google.com/uc?export=download&id=${match[1]}`;
    }
    if (url.includes('disk.yandex.ru') || url.includes('yadi.sk')) {
        return `https://yandex.net{encodeURIComponent(url)}`;
    }
    return url;
}

// 1. Загрузка данных при старте
async function init() {
    try {
        const response = await fetch('./playlist.json');
        albumsData = await response.json();
        showAlbumsGrid(); // Показываем сетку альбомов
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
    }
}

// 2. ЭКРАН А: Показ сетки всех альбомов
function showAlbumsGrid() {
    // Сбрасываем видимость элементов интерфейса
    backBtn.style.display = 'none';
    albumHeader.style.display = 'none';
    pageTitle.style.display = 'block';
    pageTitle.textContent = 'RARETENOR'; //  Популярные релизы';
    
    contentArea.className = 'albums-grid'; // Применяем стиль сетки
    contentArea.innerHTML = '';

    albumsData.forEach(album => {
        const albumCard = document.createElement('div');
        albumCard.className = 'album-card';
        albumCard.onclick = () => openAlbum(album.id); // Клик открывает альбом
        albumCard.innerHTML = `
            <img src="${album.cover}" alt="${album.title}">
            <span class="grid-badge badge-${album.type}">${album.type.toUpperCase()}</span>
            <h3>${album.title}</h3>
            <p>${album.artist}</p>
        `;
        contentArea.appendChild(albumCard);
    });
}

// 3. ЭКРАН Б: Открытие конкретного альбома
function openAlbum(albumId) {
    const album = albumsData.find(a => a.id === albumId);
    if (!album) return;

    // Настраиваем видимость
    pageTitle.style.display = 'none';
    backBtn.style.display = 'block';
    albumHeader.style.display = 'flex';
    
    // Заполняем инфо об альбоме
    albumHeader.innerHTML = `
        <img src="${album.cover}" alt="${album.title}" class="album-large-cover">
        <div class="album-info-text">
            <!-- Класс badge-${album.type} позволит раскрасить теги в разные цвета -->
            <span class="badge badge-${album.type}">${album.type.toUpperCase()}</span>
            <h2>${album.title}</h2>
            <p class="meta">${album.artist} • ${album.year} • ${album.genre}</p>
        </div>
    `;

    // Выводим список песен альбома
    contentArea.className = 'tracks-list';
    contentArea.innerHTML = '';

    album.tracks.forEach((track, index) => {
        const directUrl = getDirectLink(track.url);
        const trackRow = document.createElement('div');
        trackRow.className = 'track-item';
        trackRow.innerHTML = `
            <span class="track-number">${index + 1}</span>
            <div class="track-info">
                <h3>${track.title}</h3>
                <p>${album.artist}</p>
            </div>
            <span class="track-duration">${track.duration}</span>
            <button class="play-btn" onclick="playTrack('${directUrl}', '${album.artist} - ${track.title}')">▶</button>
        `;
        contentArea.appendChild(trackRow);
    });
}

function playTrack(url, title) {
    audioPlayer.src = url;
    audioPlayer.play();
    nowPlayingText.textContent = `Сейчас играет: ${title}`;
}

const releaseTypesRu = {
    'album': 'Альбом',
    'ep': 'EP',
    'single': 'Сингл',
    'maxi-single': 'Макси-сингл',
    'mixtape': 'Микстейп'
};

window.onload = init;
