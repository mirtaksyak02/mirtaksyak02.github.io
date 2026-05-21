let albumsData = []; // Здесь будем хранить данные из JSON
let currentAlbumTracks = []; // Список треков альбома, который сейчас играет
let currentTrackIndex = -1;  // Индекс песни, которая играет в данный момент

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
            <span class="grid-badge badge-${album.type}">${releaseTypesRu[album.type] || album.type}</span>
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

    // Настраиваем видимость элементов
    pageTitle.style.display = 'none';
    backBtn.style.display = 'block';
    albumHeader.style.display = 'flex';
    
    // Заполняем шапку альбома
    albumHeader.innerHTML = `
        <img src="${album.cover}" alt="${album.title}" class="album-large-cover">
        <div class="album-info-text">
            <span class="badge badge-${album.type}">${releaseTypesRu[album.type] || album.type}</span>
            <h2>${album.title}</h2>
            <p class="meta">${album.artist} • ${album.year} • ${album.genre}</p>
        </div>
    `;

    // Очищаем и подготавливаем область списка треков
    contentArea.className = 'tracks-list';
    contentArea.innerHTML = '';

    album.tracks.forEach((track, index) => {
        const directUrl = getDirectLink(track.url);
        
        // 1. Создаем контейнер для строки трека
        const trackRow = document.createElement('div');
        trackRow.className = 'track-item';
        
        // 2. Наполняем его текстовым контентом (здесь кавычки теперь безопасны!)
        trackRow.innerHTML = `
            <span class="track-number">${index + 1}</span>
            <div class="track-info">
                <h3>${track.title}</h3>
                <p>${album.artist}</p>
            </div>
            <span class="track-duration">${track.duration}</span>
        `;
        
        // 3. Создаем кнопку отдельно через createElement
        const playButton = document.createElement('button');
        playButton.className = 'play-btn';
        playButton.textContent = '▶';
        
        // 4. Безопасно вешаем событие клика (никаких проблем со строками и кавычками!)
        playButton.addEventListener('click', () => {
            // Передаем сам трек, его индекс в массиве и все треки этого альбома
            playTrack(track, index, album.tracks, album.artist);
        });
        
        // 5. Добавляем кнопку внутрь строки трека, а строку — на экран
        trackRow.appendChild(playButton);
        contentArea.appendChild(trackRow);
    });
}

function playTrack(track, index, tracksList, artistName) {
    // Сохраняем текущее состояние в память
    currentAlbumTracks = tracksList;
    currentTrackIndex = index;

    const directUrl = getDirectLink(track.url);
    audioPlayer.src = directUrl;
    audioPlayer.play();
    
    // Выводим информацию в нижний плеер
    nowPlayingText.textContent = `Сейчас играет: ${artistName} — ${track.title}`;
}

const releaseTypesRu = {
    'album': 'Альбом',
    'compilation': 'Компиляция',
    'ep': 'EP',
    'single': 'Сингл',
    'maxi-single': 'Макси-сингл',
    'mixtape': 'Микстейп'
};

// Функция для перехода к следующему треку
function playNextTrack() {
    // Проверяем, загружен ли плейлист и есть ли следующий трек
    if (currentAlbumTracks.length === 0 || currentTrackIndex === -1) return;

    const nextIndex = currentTrackIndex + 1;

    // Если это был последний трек в альбоме — останавливаемся (или можно пустить по кругу)
    if (nextIndex < currentAlbumTracks.length) {
        // Находим имя артиста. Так как оно лежит на уровне альбома, вытащим его из текущего экрана
        // или используем заглушку, если трек играет в фоне
        const artistName = albumsData.find(a => a.tracks.includes(currentAlbumTracks[nextIndex]))?.artist || "Исполнитель";
        
        // Запускаем следующий трек
        playTrack(currentAlbumTracks[nextIndex], nextIndex, currentAlbumTracks, artistName);
    } else {
        nowPlayingText.textContent = "Альбом завершен";
        currentTrackIndex = -1; // Сбрасываем индекс
    }
}

// Слушаем аудиоплеер: как только песня закончилась, автоматически вызываем playNextTrack
audioPlayer.addEventListener('ended', playNextTrack);
window.onload = init;
