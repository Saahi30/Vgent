"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Room,
  RoomEvent,
  Track,
  RemoteTrackPublication,
  RemoteParticipant,
  LocalParticipant,
  createLocalAudioTrack,
} from "livekit-client";

export interface TranscriptEntry {
  role: "user" | "assistant" | "system";
  text: string;
  timestamp?: number;
}

interface LiveKitRoomProps {
  livekitUrl: string;
  token: string;
  callId: string;
  wsToken: string;
  onStatusChange?: (status: "connecting" | "connected" | "disconnected") => void;
  onTranscript?: (entry: TranscriptEntry) => void;
  muted?: boolean;
}

/**
 * Manages a LiveKit room connection for browser-based test calls.
 *
 * Handles:
 * - Connecting to the LiveKit room with a browser microphone
 * - Playing back remote audio (agent TTS)
 * - Subscribing to call events via WebSocket for live transcript
 */
export function useLiveKitRoom({
  livekitUrl,
  token,
  callId,
  wsToken,
  onStatusChange,
  onTranscript,
  muted = false,
}: LiveKitRoomProps) {
  const roomRef = useRef<Room | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(async () => {
    onStatusChange?.("connecting");

    // Create room and connect
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
    roomRef.current = room;

    // Handle remote audio tracks (agent voice)
    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (track.kind === Track.Kind.Audio) {
        const audioEl = track.attach();
        audioEl.autoplay = true;
        audioEl.volume = 1.0;
        document.body.appendChild(audioEl);
        audioRef.current = audioEl;
      }
    });

    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      track.detach().forEach((el) => el.remove());
    });

    room.on(RoomEvent.Disconnected, () => {
      setIsConnected(false);
      onStatusChange?.("disconnected");
    });

    try {
      await room.connect(livekitUrl, token);

      // Publish local microphone
      const micTrack = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });
      await room.localParticipant.publishTrack(micTrack);

      if (muted) {
        await room.localParticipant.setMicrophoneEnabled(false);
      }

      setIsConnected(true);
      onStatusChange?.("connected");
    } catch (err) {
      console.error("LiveKit connection failed:", err);
      onStatusChange?.("disconnected");
    }

    // Subscribe to call events WebSocket for transcript
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";
    const ws = new WebSocket(`${wsUrl}/api/ws/calls/${callId}?token=${wsToken}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === "turn" && onTranscript) {
          onTranscript({
            role: data.role === "user" ? "user" : "assistant",
            text: data.content,
            timestamp: data.timestamp_ms,
          });
        } else if (
          data.event === "agent_joined" &&
          onTranscript
        ) {
          onTranscript({ role: "system", text: "Agent joined the call" });
        }
      } catch {
        // ignore parse errors
      }
    };
  }, [livekitUrl, token, callId, wsToken, onStatusChange, onTranscript, muted]);

  const disconnect = useCallback(() => {
    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Disconnect room
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }

    // Clean up audio element
    if (audioRef.current) {
      audioRef.current.remove();
      audioRef.current = null;
    }

    setIsConnected(false);
    onStatusChange?.("disconnected");
  }, [onStatusChange]);

  const setMuted = useCallback(
    async (mute: boolean) => {
      if (roomRef.current?.localParticipant) {
        await roomRef.current.localParticipant.setMicrophoneEnabled(!mute);
      }
    },
    []
  );

  // Clean up on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return { connect, disconnect, setMuted, isConnected };
}
