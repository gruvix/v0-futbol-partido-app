'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Users,
  Shuffle,
  Trash2,
  Share2,
  Globe,
  Lock,
  ChevronLeft,
  ChevronRight,
  Pencil,
  UserRoundPlus,
  UserRoundMinus,
  Check,
  X,
} from 'lucide-react'
import { GenderIcon, type Gender } from '@/lib/gender'
import {
  joinMatch,
  leaveMatch,
  deleteMatch,
  randomizeTeams,
  assignTeam,
  assignTeamNumber,
  removeParticipant,
  updateMatchField,
  resetTeamsToNoTeam,
  addMatchAdmin,
  removeMatchAdmin,
  changeParticipantRole,
  confirmEligibleSubstitute,
  passEligibleSubstitute,
} from '@/app/actions/matches'
import { TeamAssignment } from '@/components/team-assignment'
import { SoccerField } from '@/components/soccer-field'
import { InvitePlayersDialog } from '@/components/invite-players-dialog'
import { InlineLoader, useActionLoader } from '@/components/football-loader'
import { EditableField } from '@/components/editable-field'
import { useErrorToast } from '@/components/error-toast-provider'
import { waitForNextPaint } from '@/lib/wait-for-next-paint'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getParticipantCountsFromRoster } from '@/lib/match-summary'
import { listActiveFieldsAction } from '@/app/actions/fields'
import { getMatchVenueLabel, getCancellationPolicySummary } from '@/lib/field-display'
import type { Field } from '@/lib/fields'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface Match {
  id: number
  title: string | null
  date_time: string
  location_type: string
  location_custom: string | null
  field: string | null
  field_id: number | null
  field_name: string | null
  field_slug: string | null
  field_maps_url?: string | null
  cancellation_deadline_hours?: number | null
  cancellation_penalty?: string | null
  created_by_user_id: number
  creator_name: string
  is_public: boolean
  team_count: number
  team_size: number
  max_players: number
  invites_per_player: number | null
  field_rent_total: number | null
  auto_admin_registered_players: boolean
}

interface Participant {
  id: number
  user_id: number | null
  name: string
  phone_last_four: string
  role: 'PLAYER' | 'SUBSTITUTE'
  gender: Gender
  team: 'A' | 'B' | null
  team_number: number | null
  is_guest?: boolean
  invited_by_user_id?: number | null
  invited_by_name?: string | null
  has_paid?: boolean | null
  payment_notes?: string | null
  pixel_avatar?: string | null
}

interface Admin {
  user_id: number
  name: string
  phone_last_four: string
}

interface MatchDetailClientProps {
  match: Match
  participants: Participant[]
  admins: Admin[]
  isCreator: boolean
  isAdmin: boolean
  userParticipation?: Participant
  isPast: boolean
  currentUserId: number
}

const COMMON_TIMES = [
  '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'
]

const PICKER_HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))
const PICKER_MINUTES = ['00', '15', '30', '45']

export function MatchDetailClient({
  match,
  participants,
  admins,
  isCreator,
  isAdmin,
  userParticipation,
  isPast,
  currentUserId,
}: MatchDetailClientProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const location = getMatchVenueLabel(match)
  const cancellationPolicy = getCancellationPolicySummary({
    cancellation_deadline_hours: match.cancellation_deadline_hours,
    cancellation_penalty: match.cancellation_penalty,
  })
  return (
    <div className="flex flex-col gap-4 pb-8">
      <span>{location}</span>
      {cancellationPolicy && <span>{cancellationPolicy}</span>}
    </div>
  )
}
