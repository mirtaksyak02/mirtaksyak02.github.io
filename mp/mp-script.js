const audioPlayer = document.getElementById('main-audio');
const nowPlayingText = document.getElementById('now-playing');

// Функция для автоматического превращения ссылок в прямые
function getDirectLink(url) {
    // 1. Обработка Google Диска
    if (url.includes('://google.com')) {
        // Ищем ID файла между /d/ и /view (или концом строки)
        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            return `https://://google.com/uc?export=download&id=${match[1]}`;
        }
    }
    
    // 2. Обработка Яндекс Диска (используем публичный API Яндекса)
    if (url.includes('disk.yandex.ru') || url.includes('yadi.sk')) {
        return `https://yandex.net{encodeURIComponent(url)}`;
    }

    // Если ссылка обычная (например, прямая ссылка на .mp3 или локальный файл), возвращаем её как есть
    return url;
}

// Функция для загрузки списка треков из JSON
async function loadPlaylist() {
    try {
        const response = await fetch('./playlist.json');
        const tracks = await response.json();
        
        const playlistContainer = document.getElementById('playlist');
        
        tracks.forEach(track => {
            // Превращаем ссылку из JSON в прямую ссылку для плеера
            const directUrl = getDirectLink(track.url);

            const trackElement = document.createElement('div');
            trackElement.className = 'track-item';
            trackElement.innerHTML = `
                <img src="${track.cover}" alt="${track.title}" width="50" height="50">
                <div class="track-info">
                    <h3>${track.title}</h3>
                    <p>${track.artist} — ${track.duration}</p>
                </div>
                <!-- Передаем уже готовую прямую ссылку в функцию playTrack -->
                <button class="play-btn" onclick="playTrack('${directUrl}', '${track.artist} - ${track.title}')">▶</button>
            `;
            playlistContainer.appendChild(trackElement);
        });
    } catch (error) {
        console.error('Ошибка загрузки плейлиста:', error);
    }
}

// Функция запуска трека
function playTrack(url, title) {
    audioPlayer.src = url;
    audioPlayer.play();
    nowPlayingText.textContent = `Сейчас играет: ${title}`;
}

// Запуск при загрузке страницы
window.onload = loadPlaylist;
