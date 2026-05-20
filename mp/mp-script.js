const audioPlayer = document.getElementById('main-audio');
const nowPlayingText = document.getElementById('now-playing');

// Функция для загрузки списка треков из JSON
async function loadPlaylist() {
    try {
        const response = await fetch('./tracks.json');
        const tracks = await response.json();
        
        const playlistContainer = document.getElementById('playlist');
        
        tracks.forEach(track => {
            const trackElement = document.createElement('div');
            trackElement.className = 'track-item';
            trackElement.innerHTML = `
                <img src="${track.cover}" alt="${track.title}" width="50" height="50">
                <div class="track-info">
                    <h3>${track.title}</h3>
                    <p>${track.artist} — ${track.duration}</p>
                </div>
                <button class="play-btn" onclick="playTrack('${track.url}', '${track.artist} - ${track.title}')">▶</button>
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
